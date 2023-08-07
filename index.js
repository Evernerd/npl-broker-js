const EventEmitter = require("events");

/**
 * NPL Broker for HotPocket applications.
 * @author Wo Jake & Mark
 * @version 1.2.0
 * @description A NPL brokerage system (EVS-01) for HotPocket dApps to manage their NPL rounds.
 * 
 * See https://github.com/Evernerd/npl-broker-js to learn more and contribute to the codebase, any contribution is truly appreciated!
 */

// -- FUNCTIONS --
// init()
// .subscribeRound()
// .unsubscribeRound()
// .performNplRound()

/**
 * The NPL Broker instance.
 */
let instance;

class NPLBroker extends EventEmitter {
    /**
     * @param {*} ctx - The HotPocket contract's context.
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
     * @param {string} roundName - The NPL round name.
     * @param {Function} listener - The function that will be called per NPL message passing through the NPL round.
     */
    subscribeRound(roundName, listener) {
        if (typeof roundName !== "string") {
            throw new Error(`roundName type is not valid, must be string`);
        }

        this.on(roundName, listener);
    }

    /**
     * Remove a particular subscriber of an NPL round name, only *ONE* unique subscriber is removed per each call.
     * 
     * @param {string} roundName - The NPL round name.
     * @param {Function} listener - The function that will be removed from the NPL round name.
     */
    unsubscribeRound(roundName, listener) {
        if (typeof roundName !== "string") {
            throw new Error(`roundName type is not valid, must be string`);
        }
        
        this.removeListener(roundName, listener);
    }

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
        if (desiredCount < 1) {
            throw new Error(`desiredCount value is not valid, must be a number more than 1`);
        }
        if (typeof timeout !== "number") {
            throw new Error(`timeout type is not valid, must be number`);
        }
        if (timeout < 1) {
            throw new Error(`timeout value is not valid, must be a number more than 1`);
        }

        const NPL = (roundName, desiredCount, timeout, startingTime) => {
			return new Promise((resolve) => {
				var record = [];
                var participants = [];
                
                // The object that will be returned to this function's caller.
				const response = {
                    roundName: roundName,
                    record: record,
                    desiredCount: desiredCount,
                    timeout: timeout,
                    timeTaken: undefined,
                };

				const timer = setTimeout((roundTimeTaken = performance.now() - startingTime) => {
                    // Fire up the set timeout if we didn't receive enough NPL messages.
                    this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                    response.timeTaken = roundTimeTaken;

                    resolve(response);
				}, timeout);

                const LISTENER_NPL_ROUND_PLACEHOLDER = (packet, nodeTimeTaken = performance.now() - startingTime) => {
                    if (!participants.includes(packet.node)) {
                        participants.push(packet.node);
                        record.push({
                            "roundName": roundName, 
                            "node": packet.node,
                            "content": packet.content,
                            "timeTaken": nodeTimeTaken
                        });
                        timeTakenNodes.push(nodeTimeTaken);

                        // Resolve immediately if we have the desired no. of NPL messages.
                        if (record.length === desiredCount) {
                            clearTimeout(timer);

                            const finish = performance.now();

                            this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                            response.timeTaken = finish - startingTime;
                            
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
 * Initialize the NPLBroker class and/or return the NPL Broker instance.
 * Singelton pattern.
 * 
 * @param {object} ctx - The HotPocket contract's context.
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