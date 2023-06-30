const EventEmitter = require("events");

/**
 * NPL Broker for HotPocket applications.
 * @author Wo Jake & Mark
 * @version 0.1.0
 * @description A NPL brokerage standard implemented on NodeJS for HotPocket dApps to manage their NPL rounds.
 * 
 * See https://github.com/Evernerd/NPLBroker to learn more and contribute to the codebase, any mode of contribution is truly appreciated.
 */

// -- FUNCTIONS --
// init()
// .subscribeRound()
// .unsubscribeRound()
// .getEvents()
// .getRoundSubscribers()

const datasetEmitter = new EventEmitter(); 

/**
 * Initialize NPL Broker instance
 */
let instance;

// DEV NOTE
// The EventEmitter calls all listeners synchronously in the order in which they were registered.
// This ensures the proper sequencing of events and helps avoid race conditions and logic errors.
// When appropriate, listener functions can switch to an asynchronous mode of operation using the setImmediate() or process.nextTick() methods.
// hope this helps

class NPLBroker {
    /**
     * @param {*} mode - The NPL Broker's mode (public OR private)
     * @param {*} maxListeners - The *max* amount of event listeners or NPL round subscribers
     * @param {*} ctx - The HotPocket instance's contract context
     */
    constructor(mode, maxListeners, ctx) {

        this._mode = mode;
        this._maxListeners = maxListeners;
        this._ctx = ctx;

        /**
         * Enable NPL message receiver on this HP instance
         */
        ctx.unl.onMessage((node, payload, {roundName, content} = JSON.parse(payload)) => {
            datasetEmitter.emit(roundName, {
                node: node.publicKey,
                content: content
            });
		});

        if (mode === "public") {
            datasetEmitter.setMaxListeners(maxListeners ?? Infinity);
        } else {
            datasetEmitter.setMaxListeners(maxListeners ?? 1);
        }
    }

    /**
     * Listen (subscribe) to a particular event (NPL round).
     * 
     * @param {*} roundName - The event's name (NPL round name)
     * @param {Function} listener - The `listener` function that will be called if the event is emitted
     */
    subscribeRound(roundName, listener) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName field is not valid, cannot be [object Date]`);
        }

        if (datasetEmitter.getMaxListeners() > datasetEmitter.listenerCount(roundName)) {
            datasetEmitter.on(roundName, listener);
        } else {
            throw new Error(`roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${datasetEmitter.getMaxListeners()}!`);
        }
    }

    /**
     * Remove a particular listener from an event (NPL round), only *ONE* unique listener is removed per each call.
     * 
     * @param {*} roundName - The event's name (NPL round name)
     * @param {Function} listener - The `listener` function that will be removed from the event
     */
    unsubscribeRound(roundName, listener) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName field is not valid, cannot be [object Date]`);
        }
        
        datasetEmitter.removeListener(roundName, listener);
    }

    /**
     * Returns an array listing the events (NPL rounds) for which has registered (live) listeners.
     * 
     * @returns {array}
     */
    getEvents() {
        if (this._mode === "public") {
            return datasetEmitter.eventNames();
        } 
    };

    /**
     * Returns an array of listeners (subscribers) for the event (NPL round).
     * 
     * @param {*} roundName - The event's name (NPL round name) 
     * @returns {array}
     */
    getRoundSubscribers(roundName) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName field is not valid, cannot be [object Date]`);
        }

        if (this._mode === "public") {
            return datasetEmitter.listeners(roundName);
        }
    };

    /**
     * Perform a NPL round to distribute and collect NPL messages from UNL-peers.
     * 
     * @param {*} roundName 
     * @param {*} content
     * @param {number} desiredCount
     * @param {number} timeout
     */
    async performNplRound({roundName, content, desiredCount, timeout}, startingTime = performance.now()) {
        if (Object.prototype.toString.call(roundName) === '[object Date]') {
            throw new Error(`roundName field is not valid, cannot be [object Date]`);
        }
        if (typeof desiredCount !== "number") {
            throw new Error(`desiredCount field is not valid, must be number`);
        }
        if (typeof timeout !== "number") {
            throw new Error(`timeout field is not valid, must be number`);
        }

        const NPL = (roundName, desiredCount, timeout, startingTime) => {
			return new Promise((resolve) => {
				var record = [],
				    collectedData = [],
                    participants = [],
                    timeTakenNodes = [];

				const response = {
					roundName: roundName,
					record: record,
					data: collectedData,
					participants: participants,
					desiredCount: desiredCount,
                    desiredCountReached: collectedData.length >= desiredCount,
					timeout: timeout,
					timeTaken: undefined,
                    meanTime: undefined
				};

				const timer = setTimeout((roundTimeTaken = performance.now() - startingTime) => {
                    // Fire up the set timeout if we didn't receive enough messages.
                    datasetEmitter.removeListener(roundName, NPL_ROUND_PLACEHOLDER_DEADBEEF);

                    response.timeTaken = roundTimeTaken,
                    response.desiredCountReached = collectedData.length >= desiredCount,
                    response.participants = participants;

                    var total = 0;
                    timeTakenNodes.forEach(timeTaken => {
                        total += timeTaken;
                    }),
                    response.meanTime = total / timeTakenNodes.length;

                    resolve(response);
				}, timeout);

                const NPL_ROUND_PLACEHOLDER_DEADBEEF = (packet, nodeTimeTaken = performance.now() - startingTime) => {
                    if (!participants.includes(packet.node)) {
                        record.push({
                            "roundName": roundName, 
                            "node": packet.node, // the hotpocket node's public key
                            "content": packet.content, // the NPL packet's data
                            "timeTaken": nodeTimeTaken // the time taken for us to receive a response from *this* peer (data.node)
                        }),
                        collectedData.push(packet.content),
                        participants.push(packet.node);

                        timeTakenNodes.push(nodeTimeTaken);

                        // Resolve immediately if we have the required no. of messages.
                        if (collectedData.length === desiredCount) {
                            clearTimeout(timer);

                            const finish = performance.now();

                            datasetEmitter.removeListener(roundName, NPL_ROUND_PLACEHOLDER_DEADBEEF);

                            response.desiredCountReached = collectedData.length >= desiredCount,
                            response.timeTaken = finish - startingTime,
                            response.participants = participants;
                            
                            var total = 0;
                            timeTakenNodes.forEach(timeTaken => {
                                total += timeTaken;
                            });
                            response.meanTime = total / timeTakenNodes.length;
                            
                            resolve(response);
                        }
                    } else {
                        throw new Error(`CRITICAL - ${packet.node} sent more than 1 response in NPL round "${roundName}". Possible occurance of an overlapping NPL round`);
                    }
				}

				datasetEmitter.on(roundName, NPL_ROUND_PLACEHOLDER_DEADBEEF);
			});
		};

        if (datasetEmitter.getMaxListeners() > datasetEmitter.listenerCount(roundName)) {
            await this._ctx.unl.send(JSON.stringify({
                roundName: roundName,
                content: content
            }));
            return await NPL(roundName, desiredCount, timeout, startingTime);
        } else {
            throw new Error(`roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${datasetEmitter.getMaxListeners()}!`);
        }
    }
}

/**
 * Initialize the NPL-Broker class, which contains all the variables, functions that is available.
 * 
 * @param {string} mode - The mode for the NPL Broker (public OR private)
 * @param {number} maxListeners - The *max* amount of listeners (subscribers) that a particular event (NPL round) could have
 * @param {object} ctx - The HotPocket instance's contract context
 * @returns {object}
 */
function init({mode, maxListeners, ctx}) {
    // Singelton pattern since the intention is to only use NPLBroker instance for direct NPL access
    if (!instance) {
        instance = new NPLBroker(mode, maxListeners, ctx);
    }
    return instance;
}

module.exports = {
    init
};

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4