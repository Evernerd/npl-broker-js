const EventEmitter = require('events');
const crypto = require('crypto');
const objectStorage = require('./NPL/objectStorage.js') // the location for the NPLBroker instance (singleton pattern)

/**
* NPL Broker for HotPocket applications.
* @author Wo Jake & Mark
* @version 1.3.1
* @description A NPL brokerage module (EVS-01) for HotPocket dApps to manage their NPL rounds.
* 
* See https://github.com/Evernerd/npl-broker-js to learn more and contribute to the codebase, any contribution is truly appreciated!
*/

// -- FUNCTIONS --
// init()
// .subscribeRound()
// .unsubscribeRound()
// .performNplRound()

// Chunk transfer reference: https://datatracker.ietf.org/doc/html/rfc9112#section-7.1

class NPLBroker extends EventEmitter {
    /**
    * @param {*} ctx - The HotPocket contract's context.
    * @param {Function} stream - The listener function for NPL stream.
    */
    constructor(ctx, stream) {
        super();
        
        this.unl = ctx.unl;
        this.stream = stream ?? undefined;
        
        /**
        * Turn on the NPL channel on this HP instance.
        */
        ctx.unl.onMessage((node, payload, timeTaken = performance.now(), {roundName, chunkID, content, checksum} = JSON.parse(payload)) => {
            // !!! Dev note: DO NOT USE "stream" as an NPL round name as it is used to stream non-tagged NPL messages !!!
            if (roundName === "stream") {
                this.emit(roundName, {node: node, payload: content});
            } else {
                this.emit(roundName, {
                    node: node.publicKey,
                    chunkID: chunkID ?? undefined,
                    content: content,
                    checksum: checksum,
                    timeTaken: timeTaken
                });
            }
        });
        
        if (this.stream !== undefined) {
            this.on("stream", this.stream);
        }
        
        this.setMaxListeners(Infinity);
    }
    
    /**
    * Broadcast a non-tagged NPL message.
    * 
    * @param {*} packet 
    */
    async send(packet) {
        await this.unl.send(JSON.stringify({
            roundName: "stream",
            content: packet
        }));
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
    * @param {boolean} checksum - Check the content's integrity upon arrival (Content Integrity)
    * @param {number} timeout - The time interval given to this NPL round to conclude.
    * @returns {object}
    */
    async performNplRound({roundName, content, desiredCount, checksum, timeout, /**retransmission*/}, startingTime = performance.now()) {
        if (typeof roundName !== "string") {
            throw new Error(`roundName type is not valid, must be string`);
        }
        if (typeof desiredCount !== "number") {
            throw new Error(`desiredCount type is not valid, must be number`);
        }
        if (desiredCount < 1) {
            throw new Error(`desiredCount value is not valid, must be a number more than 1`);
        }
        if (!Number.isInteger(desiredCount)) {
            throw new Error(`desiredCount value is not valid, must be a whole number`);
        }
        if (checksum !== undefined && typeof checksum !== "boolean") {
            throw new Error(`checksum type is not valid, must be boolean`);
        }
        if (typeof timeout !== "number") {
            throw new Error(`timeout type is not valid, must be number`);
        }
        if (timeout < 1) {
            throw new Error(`timeout value is not valid, must be a number more than 1`);
        }
        // if (retransmission !== false || retransmission !== true) {
        //     throw new Error(`retransmission type is not valid, must be boolean`);
        // }
        
        const receiveNPL = () => {
            return new Promise((resolve) => {
                /** Record of full NPL messages */
                var record = [];
                /** Record of all NPL participants in that round */
                var participants = [];
                /** Chunked messages awaiting to be combined once fully received entire message */
                var message_chunks = {};
                /** An indicator to tell if the node is receiving chunked messages, enabling chunk transfer mechanism */
                var chunk_transfer = false;
                
                /** The object that will be returned to this function's caller. */
                const response = {
                    roundName: roundName,
                    record: record,
                    desiredCount: desiredCount,
                    checksum: undefined,
                    timeout: timeout,
                    timeTaken: timeout
                };
                
                let timer = setTimeout(() => {
                    // Fire up the set timeout if we didn't receive enough NPL messages.
                                        
                    this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                    resolve(response);
                }, timeout);
                
                const LISTENER_NPL_ROUND_PLACEHOLDER = (packet) => {
                    if (!participants.includes(packet.node) || packet.chunkID !== undefined) {
                        if (!participants.includes(packet.node)) {
                            participants.push(packet.node);
                        }
                        if (packet.chunkID !== undefined) {
                            chunk_transfer = true;
                        }
                        if (packet.checksum !== undefined) {
                            if (packet.content === null) {
                                var message = message_chunks[packet.node].join('');
                            } else {
                                var message = packet.content;
                            }
                            var content_hash = crypto.createHash('sha256').update(message).digest('hex');
                        } 
                        
                        if (!chunk_transfer) {
                            // Whole message transmitted 
                            if (packet.checksum === content_hash || packet.checksum === undefined) {
                                record.push({
                                    "roundName": roundName,
                                    "node": packet.node,
                                    "content": packet.content,
                                    "checksum": packet.checksum,
                                    "timeTaken": packet.timeTaken - startingTime
                                });
                            } else {
                                // We've received a damaged packet, request retransmission (ACK must be introduced soon in HP enhancement)
                            }
                        } else {
                            // Chunked messages
                            if (message_chunks[packet.node] === undefined) {
                                message_chunks[packet.node] = [];
                            }
                            
                            if (packet.content !== null) {
                                if (packet.checksum === content_hash || packet.checksum === undefined) {
                                    message_chunks[packet.node].push(packet.content);
                                } else {
                                    // We've received a damaged packet, force stop chunk transfer & request retransmission
                                }
                            } else {
                                // Last chunk message indicating the end of the chunk transfer
                                if (message_chunks[packet.node].length === Number(packet.chunkID)
                                && packet.checksum === content_hash) {
                                    record.push({
                                        "roundName": roundName,
                                        "node": packet.node,
                                        "content": message_chunks[packet.node].join(''),
                                        "checksum": packet.checksum,
                                        "timeTaken": packet.timeTaken - startingTime
                                    })
                                } // else if (packet.retransmission === true) {
                                //     // Assess which chunk packet was lost via ChunkID check & request for a retransmission of the lost messages
                                
                                //     /** REMOVABLE NOTE:
                                //     * Depending on how HotPocket is developed in the future for an ACK mechanism,
                                //     * We may need to change (improve!) how we handle packet retransmission (fallback mode).
                                //     */
                                
                                //     var _sequence_check = 0;
                                //     var lost_chunkID = [];
                                
                                //     message_chunks[packet.node].forEach(chunk => {
                                //         if (Number(chunk.sequence) === _sequence_check) {
                                //             full_message = full_message+chunk.content;
                                //         } else {
                                //             lost_chunkID.push(_sequence_check);
                                //         }
                                //         _sequence_check++;
                                //         console.log("Lost chunks (by ID):", lost_chunkID);
                                //     });
                                
                                //     // DEV NOT: (ADD) We are supposed to send the missing chunks to the sender & request retransmission.
                                // }
                            }
                        }
                        
                        // Resolve immediately if we have the desired no. of NPL messages.
                        if (record.length === desiredCount) {
                            clearTimeout(timer);
                                                        
                            response.timeTaken = performance.now() - startingTime;
                            
                            this.removeListener(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);

                            resolve(response);
                        }
                    } else {
                        resolve (new Error(`${packet.node} sent more than 1 message in NPL round "${roundName}". Potentially an NPL round overlap`));
                    }
                }
                
                // Temporarily subscribe to the NPL round name
                // `LISTENER_NPL_ROUND_PLACEHOLDER` is the function that will be handling all emits (NPL messages)
                this.on(roundName, LISTENER_NPL_ROUND_PLACEHOLDER);
            });
        };
        
        const sendNPL = async () => {
            if (checksum) {
                var checksum_hash = crypto.createHash('sha256').update(content).digest('hex');
            }
            
            let npl_message = {
                roundName: roundName,
                content: content,
                checksum: checksum_hash
            }
            
            try {
                const _npl_submission = await this.unl.send(JSON.stringify(npl_message));
            } catch (err) {
                // If it is a recognized error (NPL message size is too large), we proceed with chunk transfer
                this.size_limit = Number(err.replace(/\D/g, '')) - 60; // (the npl message size limit - JSON format size)
                
                if (npl_message.roundName.length > this.size_limit) {
                    throw new Error(`roundName size is too big`);
                }

                let npl_packets = [];
                const content_hash = crypto.createHash('sha256').update(npl_message.content).digest('hex');
                const maxMessageSize = this.size_limit-roundName.length;
                
                while (npl_message.content.length > 0) {
                    const message_chunk = npl_message.content.slice(0, maxMessageSize)
                    if (checksum) {
                        var checksum_hash = crypto.createHash('sha256').update(message_chunk).digest('hex');
                    }
                    
                    npl_packets.push({
                        roundName: roundName,
                        chunkID: npl_packets.length.toString().padStart(4, "0"),
                        content: message_chunk,
                        checksum: checksum_hash
                    });
                    npl_message.content = npl_message.content.slice(maxMessageSize);
                    
                    if (npl_message.content.length === 0) {
                        // The last chunk packet is empty as it is used to verify that the chunk transfer is finished,
                        // The checksum is used to verify the entire transfer's content integrity
                        npl_packets.push({
                            roundName: roundName,
                            chunkID: npl_packets.length.toString().padStart(4, "0"),
                            // retransmission: retransmission,
                            content: null,
                            checksum: content_hash
                        });
                    }
                }
                
                npl_packets.forEach(async (packet) => {
                    const _npl_submission = await this.unl.send(JSON.stringify(packet));
                })
            }
        }
        
        await sendNPL();
        const NPL_round_result = await receiveNPL();
        
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
* @param {Function} stream - The listener function for NPL stream.
* @returns {object}
*/
function init(ctx, stream) {
    // Singelton pattern since the intention is to only use NPLBroker instance for direct NPL access.
    // If the NPL broker instance has been initialized, return the broker's instance to the call,
    // this ensures that the broker is accessible to all components of the HP dApp
    let instance = objectStorage.get();
    if (instance === null) {
        instance = new NPLBroker(ctx, stream);
        objectStorage.set(instance);
    }
    return instance;
}

module.exports = {
    init
};

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4