const EventEmitter = require("events");

/**
 * NPL Broker for HotPocket applications.
 * @author Wo Jake & Mark
 * @version 0.2.0
 * @description A NPL brokerage system (EVS-01) for HotPocket dApps to manage their NPL rounds.
 * 
 * See https://github.com/Evernerd/npl-broker-js to learn more and contribute to the codebase, any contribution is truly appreciated!
 */

// -- FUNCTIONS --
// init()
// .subscribeRound()
// .unsubscribeRound()
// .getEvents()
// .getRoundSubscribers()
// .performNplRound()

/**
 * The NPL Broker instance.
 */
let instance;

// DEV NOTE ON EventEmitter()
// The EventEmitter calls all listeners synchronously in the order in which they were registered.
// This ensures the proper sequencing of events and helps avoid race conditions and logic errors.
// When appropriate, listener functions can switch to an asynchronous mode of operation using the setImmediate() or process.nextTick() methods.
// hope this helps

class NPLBroker extends EventEmitter {
    /**
     * @param {*} ctx - The HotPocket instance's contract context.
     */
    constructor(ctx) {
        super();

        this._ctx = ctx;

        /**
         * Turn on the NPL channel on this HP instance.
         */
        ctx.unl.onMessage((node, payload, {roundName, content} = JSON.parse(payload)) => {
            this.emit(roundName, {
                node: node.publicKey,
                content: content
            });
		});

        this.setMaxListeners(Infinity);
    }

    /**
     * Subscribe to an NPL round name.
     * 
     * @param {*} roundName - The NPL round name.
     * @param {Function} listener - The function that will be called per NPL message passing through the NPL round.
     */
    subscribeRound(roundName, listener) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName type is not valid, cannot be [object Date]`);
        }

        this.on(roundName, listener);
    }

    /**
     * Remove a particular subscriber of an NPL round name, only *ONE* unique subscriber is removed per each call.
     * 
     * @param {*} roundName - The NPL round name.
     * @param {Function} listener - The function that will be removed from the NPL round name.
     */
    unsubscribeRound(roundName, listener) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName type is not valid, cannot be [object Date]`);
        }
        
        this.removeListener(roundName, listener);
    }

    /**
     * Returns an array listing the NPL round names that have live subscribers.
     * 
     * @returns {array}
     */
    getEvents() {
        return this.eventNames();
    };

    /**
     * Returns an array of subscribers of an NPL round name.
     * 
     * @param {*} roundName - The NPL round name.
     * @returns {array}
     */
    getRoundSubscribers(roundName) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName field is not valid, cannot be [object Date]`);
        }

        return this.listeners(roundName);
    };

    /**
     * Perform an NPL round to distribute and collect NPL messages from peers.
     * 
     * @param {string} roundName - The NPL round name. This *must* be unique.
     * @param {*} content - The content that will be distributed to this instance's peers.
     * @param {number} desiredCount - The desired count of NPL messages to collect.
     * @param {number} timeout - The time interval given to this NPL round to conclude.
     * @returns {object}
     */
    async performNplRound({roundName, content, desiredCount, timeout}, startingTime = performance.now()) {
        if (typeof roundName !== "string") {
            throw new Error(`roundName type is not valid, must be string`);
        }
        if (typeof desiredCount !== "number") {
            throw new Error(`desiredCount type is not valid, must be number`);
        }
        if (typeof timeout !== "number") {
            throw new Error(`timeout type is not valid, must be number`);
        }

        const NPL = (roundName, desiredCount, timeout, startingTime) => {
			return new Promise((resolve) => {
				var record = [],
                    participants = [],
                    timeTakenNodes = [];

                // The object that will be returned to this function's caller
				const response = {
					roundName: roundName,
					record: record,
					desiredCount: desiredCount,
                    responseCount: record.length,
					timeout: timeout,
					timeTaken: undefined,
                    meanTime: undefined
				};

				const timer = setTimeout((roundTimeTaken = performance.now() - startingTime) => {
                    // Fire up the set timeout if we didn't receive enough NPL messages.
                    this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                    response.timeTaken = roundTimeTaken,
                    response.responseCount = record.length;

                    var total = 0;
                    timeTakenNodes.forEach(timeTaken => {
                        total += timeTaken;
                    }),
                    response.meanTime = total / timeTakenNodes.length;

                    resolve(response);
				}, timeout);

                const LISTENER_NPL_ROUND_PLACEHOLDER = (packet, nodeTimeTaken = performance.now() - startingTime) => {
                    if (!participants.includes(packet.node)) {
                        participants.push(packet.node),
                        record.push({
                            "roundName": roundName, 
                            "node": packet.node, // the hotpocket node's public key
                            "content": packet.content, // the NPL packet's data
                            "timeTaken": nodeTimeTaken // the time taken for us to receive a response from *this* peer (data.node)
                        }),
                        timeTakenNodes.push(nodeTimeTaken);

                        // Resolve immediately if we have the desired no. of NPL messages.
                        if (record.length === desiredCount) {
                            clearTimeout(timer);

                            const finish = performance.now();

                            this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                            response.timeTaken = finish - startingTime,
                            response.responseCount = record.length;

                            var total = 0;
                            timeTakenNodes.forEach(timeTaken => {
                                total += timeTaken;
                            });
                            response.meanTime = total / timeTakenNodes.length;
                            
                            resolve(response);
                        }
                    } else {
                        resolve (new Error(`${packet.node} sent more than 1 message in NPL round "${roundName}". Potentially an NPL round overlap.`));
                    }
				}

                // Temporarily subscribe to the NPL round name
                // `LISTENER_NPL_ROUND_PLACEHOLDER` is the function that will be handling all emits (NPL messages)
				this.on(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);
			});
		};

        await this._ctx.unl.send(JSON.stringify({
            roundName: roundName,
            content: content
        }));
        const NPL_round_result = await NPL(roundName, desiredCount, timeout, startingTime);

        if (NPL_round_result instanceof Error) {
            throw NPL_round_result;
        } else {
            return NPL_round_result;
        }
    }
}

/**
 * Initialize the NPLBroker class and return the NPL Broker instance.
 * Singelton pattern.
 * 
 * @param {object} ctx - The HotPocket instance's contract context.
 * @returns {object}
 */
function init(ctx) {
    // Singelton pattern since the intention is to only use NPLBroker instance for direct NPL access.
    // If the NPL broker instance has been initialized, return the broker's instance to the call,
    // this ensures that the broker is accessible to all components of the HP dApp
    if (!instance) {
        instance = new NPLBroker(ctx);
    }
    return instance;
}

module.exports = {
    init
};

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4