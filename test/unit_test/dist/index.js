/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 277:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const EventEmitter = __nccwpck_require__(361);
const crypto = __nccwpck_require__(113);
const objectStorage = __nccwpck_require__(907) // the location for the NPLBroker instance (singleton pattern)

/**
* NPL Broker for HotPocket applications.
* @author Wo Jake & Mark
* @version 1.3.2
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
    * @param {Function} stream - (Optional) The listener function for non-tagged NPL stream.
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
* Singleton pattern.
* 
* @param {object} ctx - The HotPocket contract's context.
* @param {Function} stream - The listener function for NPL stream.
* @returns {object}
*/
function init(ctx, stream) {
    // Singleton pattern since the intention is to only use NPLBroker instance for direct NPL access.
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

/***/ }),

/***/ 713:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 782:
/***/ ((__unused_webpack_module, __webpack_exports__, __nccwpck_require2_) => {

"use strict";
__nccwpck_require2_.r(__webpack_exports__);
/* harmony export */ __nccwpck_require2_.d(__webpack_exports__, {
/* harmony export */   "controlMessages": () => (/* binding */ controlMessages),
/* harmony export */   "clientProtocols": () => (/* binding */ clientProtocols),
/* harmony export */   "constants": () => (/* binding */ constants),
/* harmony export */   "writeAsync": () => (/* binding */ writeAsync),
/* harmony export */   "writevAsync": () => (/* binding */ writevAsync),
/* harmony export */   "readAsync": () => (/* binding */ readAsync),
/* harmony export */   "invokeCallback": () => (/* binding */ invokeCallback),
/* harmony export */   "errHandler": () => (/* binding */ errHandler)
/* harmony export */ });
const fs = __nccwpck_require2_(147);

const controlMessages = {
    peerChangeset: "peer_changeset"
}
Object.freeze(controlMessages);

const clientProtocols = {
    json: "json",
    bson: "bson"
}
Object.freeze(clientProtocols);

const constants = {
    MAX_SEQ_PACKET_SIZE: 128 * 1024,
    PATCH_CONFIG_PATH: "../patch.cfg",
    POST_EXEC_SCRIPT_NAME: "post_exec.sh"
}
Object.freeze(constants);

function writeAsync(fd, buf) {
    return new Promise(resolve => fs.write(fd, buf, resolve));
}
function writevAsync(fd, bufList) {
    return new Promise(resolve => fs.writev(fd, bufList, resolve));
}
function readAsync(fd, buf, offset, size) {
    return new Promise(resolve => fs.read(fd, buf, 0, size, offset, resolve));
}

async function invokeCallback(callback, ...args) {
    if (!callback)
        return;

    if (callback.constructor.name === 'AsyncFunction') {
        await callback(...args).catch(errHandler);
    }
    else {
        callback(...args);
    }
}

function errHandler(err) {
    console.log(err);
}

/***/ }),

/***/ 244:
/***/ ((__unused_webpack_module, __webpack_exports__, __nccwpck_require2_) => {

"use strict";
// ESM COMPAT FLAG
__nccwpck_require2_.r(__webpack_exports__);

// EXPORTS
__nccwpck_require2_.d(__webpack_exports__, {
  "HotPocketContract": () => (/* binding */ HotPocketContract)
});

// EXTERNAL MODULE: ./src/common.js
var common = __nccwpck_require2_(782);
;// CONCATENATED MODULE: ./src/patch-config.js


const fs = __nccwpck_require2_(147);

// Handles patch config manipulation.
class PatchConfig {

    // Loads the config value if there's a patch config file. Otherwise throw error.
    getConfig() {
        if (!fs.existsSync(common.constants.PATCH_CONFIG_PATH))
            throw "Patch config file does not exist.";

        return new Promise((resolve, reject) => {
            fs.readFile(common.constants.PATCH_CONFIG_PATH, 'utf8', function (err, data) {
                if (err) reject(err);
                else resolve(JSON.parse(data));
            });
        });
    }

    updateConfig(config) {

        this.validateConfig(config);

        return new Promise((resolve, reject) => {
            // Format json to match with the patch.cfg json format created by HP at the startup.
            fs.writeFile(common.constants.PATCH_CONFIG_PATH, JSON.stringify(config, null, 4), (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    validateConfig(config) {
        // Validate all config fields.
        if (!config.version)
            throw "Contract version is not specified.";
        if (!config.unl || !config.unl.length)
            throw "UNL list cannot be empty.";
        for (let publicKey of config.unl) {
            // Public keys are validated against length, ed prefix and hex characters.
            if (!publicKey.length)
                throw "UNL public key not specified.";
            else if (!(/^(e|E)(d|D)[0-9a-fA-F]{64}$/g.test(publicKey)))
                throw "Invalid UNL public key specified.";
        }
        if (!config.bin_path || !config.bin_path.length)
            throw "Binary path cannot be empty.";
        if (config.consensus.mode != "public" && config.consensus.mode != "private")
            throw "Invalid consensus mode configured in patch file. Valid values: public|private";
        if (config.consensus.roundtime < 1 && config.consensus.roundtime > 3600000)
            throw "Round time must be between 1 and 3600000ms inclusive.";
        if (config.consensus.stage_slice < 1 || config.consensus.stage_slice > 33)
            throw "Stage slice must be between 1 and 33 percent inclusive.";
        if (config.consensus.threshold < 1 || config.consensus.threshold > 100)
            throw "Consensus threshold must be between 1 and 100 percent inclusive.";
        if (config.npl.mode != "public" && config.npl.mode != "private")
            throw "Invalid npl mode configured in patch file. Valid values: public|private";
        if (config.round_limits.user_input_bytes < 0 || config.round_limits.user_output_bytes < 0 || config.round_limits.npl_output_bytes < 0 ||
            config.round_limits.proc_cpu_seconds < 0 || config.round_limits.proc_mem_bytes < 0 || config.round_limits.proc_ofd_count < 0)
            throw "Invalid round limits.";
        if (config.max_input_ledger_offset < 0)
            throw "Invalid max input ledger offset";
    }
}
;// CONCATENATED MODULE: ./src/contract-context.js



// HotPocket contract context which is passed into every smart contract invocation.

class ContractContext {

    #patchConfig = null;
    #controlChannel = null;

    constructor(hpargs, users, unl, controlChannel) {
        this.#patchConfig = new PatchConfig();
        this.#controlChannel = controlChannel;
        this.contractId = hpargs.contract_id;
        this.publicKey = hpargs.public_key;
        this.privateKey = hpargs.private_key;
        this.readonly = hpargs.readonly;
        this.timestamp = hpargs.timestamp;
        this.users = users;
        this.unl = unl; // Not available in readonly mode.
        this.lclSeqNo = hpargs.lcl_seq_no; // Not available in readonly mode.
        this.lclHash = hpargs.lcl_hash; // Not available in readonly mode.
    }

    // Returns the config values in patch config.
    getConfig() {
        return this.#patchConfig.getConfig();
    }

    // Updates the config with given config object and save the patch config.
    updateConfig(config) {
        return this.#patchConfig.updateConfig(config);
    }

    // Updates the known-peers this node must attempt connections to.
    // toAdd: Array of strings containing peers to be added. Each string must be in the format of "<ip>:<port>".
    updatePeers(toAdd, toRemove) {
        return this.#controlChannel.send({
            type: common.controlMessages.peerChangeset,
            add: toAdd || [],
            remove: toRemove || []
        });
    }
}
;// CONCATENATED MODULE: ./src/control.js
const control_fs = __nccwpck_require2_(147);


class ControlChannel {

    #fd = null;
    #readStream = null;

    constructor(fd) {
        this.#fd = fd;
    }

    consume(onMessage) {

        if (this.#readStream)
            throw "Control channel already consumed.";

        this.#readStream = control_fs.createReadStream(null, { fd: this.#fd, highWaterMark: common.constants.MAX_SEQ_PACKET_SIZE });
        this.#readStream.on("data", onMessage);
        this.#readStream.on("error", (err) => { });
    }

    send(obj) {
        const buf = Buffer.from(JSON.stringify(obj));
        if (buf.length > common.constants.MAX_SEQ_PACKET_SIZE)
            throw ("Control message exceeds max size " + common.constants.MAX_SEQ_PACKET_SIZE);
        return (0,common.writeAsync)(this.#fd, buf);
    }

    close() {
        this.#readStream && this.#readStream.close();
    }
}
;// CONCATENATED MODULE: ./src/npl.js


const npl_fs = __nccwpck_require2_(147);

// Represents the node-party-line that can be used to communicate with unl nodes.
class NplChannel {

    #fd = null;
    #readStream = null;

    constructor(fd) {
        this.#fd = fd;
    }

    consume(onMessage) {

        if (this.#readStream)
            throw "NPL channel already consumed.";

        this.#readStream = npl_fs.createReadStream(null, { fd: this.#fd, highWaterMark: common.constants.MAX_SEQ_PACKET_SIZE });

        // When hotpocket is sending the npl messages, first it sends the public key of the particular node
        // and then the message, First data buffer is taken as public key and the second one as message,
        // then npl message object is constructed and the event is emmited.
        let publicKey = null;

        this.#readStream.on("data", (data) => {
            if (!publicKey) {
                publicKey = data.toString();
            }
            else {
                onMessage(publicKey, data);
                publicKey = null;
            }
        });

        this.#readStream.on("error", (err) => { });
    }

    send(msg) {
        const buf = Buffer.from(msg);
        if (buf.length > common.constants.MAX_SEQ_PACKET_SIZE)
            throw ("NPL message exceeds max size " + common.constants.MAX_SEQ_PACKET_SIZE);
        return (0,common.writeAsync)(this.#fd, buf);
    }

    close() {
        this.#readStream && this.#readStream.close();
    }
}

;// CONCATENATED MODULE: ./src/unl.js


class UnlCollection {

    #readonly = null;
    #pendingTasks = null;
    #channel = null;

    constructor(readonly, unl, channel, pendingTasks) {
        this.nodes = {};
        this.#readonly = readonly;
        this.#pendingTasks = pendingTasks;

        if (!readonly) {
            for (const [publicKey, stat] of Object.entries(unl)) {
                this.nodes[publicKey] = new UnlNode(publicKey, stat.active_on);
            }

            this.#channel = channel;
        }
    }

    // Returns the unl node for the specified public key. Returns null if not found.
    find(publicKey) {
        return this.nodes[publicKey];
    }

    // Returns all the unl nodes.
    list() {
        return Object.values(this.nodes);
    }

    count() {
        return Object.keys(this.nodes).length;
    }

    // Registers for NPL messages.
    onMessage(callback) {

        if (this.#readonly)
            throw "NPL messages not available in readonly mode.";

        this.#channel.consume((publicKey, msg) => {
            this.#pendingTasks.push((0,common.invokeCallback)(callback, this.nodes[publicKey], msg));
        });
    }

    // Broadcasts a message to all unl nodes (including self if self is part of unl).
    async send(msg) {
        if (this.#readonly)
            throw "NPL messages not available in readonly mode.";

        await this.#channel.send(msg);
    }
}

// Represents a node that's part of unl.
class UnlNode {

    constructor(publicKey, activeOn) {
        this.publicKey = publicKey;
        this.activeOn = activeOn;
    }
}
;// CONCATENATED MODULE: ./src/user.js


class UsersCollection {

    #users = {};
    #infd = null;

    constructor(userInputsFd, usersObj, clientProtocol) {
        this.#infd = userInputsFd;

        Object.entries(usersObj).forEach(([publicKey, arr]) => {

            const outfd = arr[0]; // First array element is the output fd.
            arr.splice(0, 1); // Remove first element (output fd). The rest are pairs of msg offset/length tuples.

            const channel = new UserChannel(outfd, clientProtocol);
            this.#users[publicKey] = new User(publicKey, channel, arr);
        });
    }

    // Returns the User for the specified public key. Returns null if not found.
    find(publicKey) {
        return this.#users[publicKey]
    }

    // Returns all the currently connected users.
    list() {
        return Object.values(this.#users);
    }

    count() {
        return Object.keys(this.#users).length;
    }

    async read(input) {
        const [offset, size] = input;
        const buf = Buffer.alloc(size);
        await (0,common.readAsync)(this.#infd, buf, offset, size);
        return buf;
    }
}

class User {

    #channel = null;

    constructor(publicKey, channel, inputs) {
        this.publicKey = publicKey;
        this.inputs = inputs;
        this.#channel = channel;
    }

    async send(msg) {
        await this.#channel.send(msg);
    }
}

class UserChannel {

    #outfd = null;
    #clientProtocol = null;

    constructor(outfd, clientProtocol) {
        this.#outfd = outfd;
        this.#clientProtocol = clientProtocol;
    }

    send(msg) {
        const messageBuf = this.serialize(msg);
        let headerBuf = Buffer.alloc(4);
        // Writing message length in big endian format.
        headerBuf.writeUInt32BE(messageBuf.byteLength)
        return (0,common.writevAsync)(this.#outfd, [headerBuf, messageBuf]);
    }

    serialize(msg) {

        if (!msg)
            throw "Cannot serialize null content.";

        if (Buffer.isBuffer(msg))
            return msg;
        else if (this.#clientProtocol == common.clientProtocols.bson)
            return Buffer.from(msg);
        else // json
            return Buffer.from(JSON.stringify(msg));
    }
}
;// CONCATENATED MODULE: ./src/hotpocket-contract.js







const hotpocket_contract_fs = __nccwpck_require2_(147);
const tty = __nccwpck_require2_(224);

class HotPocketContract {

    #controlChannel = null;
    #clientProtocol = null;
    #forceTerminate = false;

    init(contractFunc, clientProtocol = common.clientProtocols.json, forceTerminate = false) {

        return new Promise(resolve => {
            if (this.#controlChannel) { // Already initialized.
                resolve(false);
                return;
            }

            this.#clientProtocol = clientProtocol;

            // Check whether we are running on a console and provide error.
            if (tty.isatty(process.stdin.fd)) {
                console.error("Error: HotPocket smart contracts must be executed via HotPocket.");
                resolve(false);
                return;
            }

            this.#forceTerminate = forceTerminate;

            // Parse HotPocket args.
            hotpocket_contract_fs.readFile(process.stdin.fd, 'utf8', (err, argsJson) => {
                const hpargs = JSON.parse(argsJson);
                this.#controlChannel = new ControlChannel(hpargs.control_fd);
                this.#executeContract(hpargs, contractFunc);
                resolve(true);
            });
        });
    }

    #executeContract(hpargs, contractFunc) {
        // Keeps track of all the tasks (promises) that must be awaited before the termination.
        const pendingTasks = [];
        const nplChannel = new NplChannel(hpargs.npl_fd);

        const users = new UsersCollection(hpargs.user_in_fd, hpargs.users, this.#clientProtocol);
        const unl = new UnlCollection(hpargs.readonly, hpargs.unl, nplChannel, pendingTasks);
        const executionContext = new ContractContext(hpargs, users, unl, this.#controlChannel);

        (0,common.invokeCallback)(contractFunc, executionContext).catch(common.errHandler).finally(() => {
            // Wait for any pending tasks added during execution.
            Promise.all(pendingTasks).catch(common.errHandler).finally(() => {
                nplChannel.close();
                this.#terminate();
            });
        });
    }

    #terminate() {
        this.#controlChannel.close();
        if (this.#forceTerminate)
            process.kill(process.pid, 'SIGINT');
    }
}

/***/ }),

/***/ 53:
/***/ ((module, __unused_webpack_exports, __nccwpck_require2_) => {

const { clientProtocols, constants } = __nccwpck_require2_(782);
const { HotPocketContract } = __nccwpck_require2_(244);

module.exports = {
    Contract: HotPocketContract,
    clientProtocols,
    POST_EXEC_SCRIPT_NAME: constants.POST_EXEC_SCRIPT_NAME,
}

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = __nccwpck_require__(147);

/***/ }),

/***/ 224:
/***/ ((module) => {

"use strict";
module.exports = __nccwpck_require__(224);

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require2_(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require2_);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__nccwpck_require2_.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__nccwpck_require2_.o(definition, key) && !__nccwpck_require2_.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__nccwpck_require2_.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__nccwpck_require2_.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require2_ !== 'undefined') __nccwpck_require2_.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require2_(53);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;

/***/ }),

/***/ 907:
/***/ ((module) => {

module.exports = eval("require")("./NPL/objectStorage.js");


/***/ }),

/***/ 113:
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ 361:
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 224:
/***/ ((module) => {

"use strict";
module.exports = require("tty");

/***/ }),

/***/ 114:
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('{"name":"npl-broker","version":"1.3.2","description":"A NPL brokerage standard (EVS01) implemented on NodeJS for HotPocket instances to manage their NPL rounds in a systematic manner.","main":"index.js","scripts":{"test":"sudo hpdevkit clean && sudo npm link && cd test/unit_test/src && sudo npm link npl-broker && sudo HP_CLUSTER_SIZE=6 npm start"},"repository":{"type":"git","url":"git+https://github.com/Evernerd/npl-broker-js.git"},"keywords":["NPL","HotPocket","Evernode"],"author":"Wo Jake","license":"MIT","bugs":{"url":"https://github.com/Evernerd/npl-broker-js/issues"},"homepage":"https://github.com/Evernerd/npl-broker-js#readme"}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/**
 * 1. This unit test is performed locally in the tester's environment.
 * 2. This unit test aims to ensure npl-broker functions stably as expected with the intended model and code.
 * 3. Each feature of npl-broker must be included in this file in its own respective test case and other overlapping features.
 * 4. Each test case SHOULD include its description, objective, expected result and failure conditions in the code.
 * 
 * TODO:
 * -- Use jest
 * -- Add unit test for Evernode `production` network (mainnet) and testnet. 
 */

/**
 * START UNIT TEST
 */
const HotPocket = __nccwpck_require__(713);
const NPLBroker = __nccwpck_require__(277);
const crypto = __nccwpck_require__(113);
const fs = __nccwpck_require__(147);

var package = __nccwpck_require__(114);

console.log(`Dependencies: ${package.dependencies}`);

async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the broker's NPL stream works as intended
 */
async function testNplStream(NPL, messageCount) {
    while (messageCount > 0) {
        // Test JSON
        await NPL.send(JSON.stringify({
            content: "dinner with Wo Jake or dinner with Bharath ? 321 @#$",
            randomNumber: 123589,
            randomBoolean: true,
            randomArray: ["Wo Jake", "Bharath"]
        }));        
        // Test string
        await NPL.send("dinner with Wo Jake or dinner with Bharath ? 321 @#$");
        // Test number
        await NPL.send(1234567890);
        // Test boolean
        await NPL.send(true);
        // Test array
        await NPL.send(["Wo", "Jake", "is", "awesome", 3000, true]);
        // Test object
        await NPL.send({"hot":"pocket", "variable": 123, "bool": true});
        messageCount--;
    }    
}

/**
 * Check if we could get the precise number of desired NPL messages
 */
async function testGetDesiredCount(ctx, NPL, roundName, timeout) {
    var point = 0;
    for (let x = 0; x < ctx.unl.count(); x++) {    
        const start = performance.now();
        const test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count() - x,
            timeout: timeout / 2
        });
        const timeTaken = performance.now() - start;

        await delay(timeout - timeTaken);

        if (test_NPL_round.record.length === test_NPL_round.desiredCount) { point++; }
    }
    if (point === ctx.unl.count()) {
        console.log(` --  performNplRound() |              desiredCount threshold: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |              desiredCount threshold: ❌ (${point}/${ctx.unl.count()})`);
        return false;
    }
}

/**
 * Check if we could trigger an Error which indicates that an NPL round overlap is occurring 
 */
async function testTriggerOverlappingNplRoundError(ctx, NPL, roundName, timeout) {
    try {
        const _test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round1 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 123",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round2 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 213",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round3 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 312",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });
    } catch (err) {
        // error is unique!
        console.log(` --  performNplRound() |       avoided overlapping NPL round: ✅`)
        return true;
    }
    console.log(` --  performNplRound() |  didn't avoid overlapping NPL round: ❌`)
    return false;
}


/**
 * Check if the checksum is valid, verify the content's integrity on the sender's side 
 */
async function testGetValidChecksum(ctx, NPL, roundName, timeout) {
    const test_NPL_round = await NPL.performNplRound({
        roundName: roundName,
        content: "test content 312 _-= !@# ABC abc",
        desiredCount: ctx.unl.count(),
        checksum: true,
        timeout: timeout
    });

    var point = 0;
    test_NPL_round.record.forEach(message => {
        if (message.checksum === crypto.createHash('sha256').update(message.content).digest('hex')) {
            point++;
        }
    })

    if (point > 0) {
        console.log(` --  performNplRound() |                   checksum is valid: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |                 checksum is invalid: ❌`);
        return false;
    }
}

/** 
 * Check if our large content enables chunk transfer
 */
async function testTriggerChunkTransfer(ctx, NPL, roundName, timeout) {
    const string_size_270k_characters = fs.readFileSync(__dirname+"/large.txt", 'utf8');
    
    const test_NPL_round = await NPL.performNplRound({
        roundName: roundName,
        content: string_size_270k_characters,
        desiredCount: ctx.unl.count() / 2,
        timeout: timeout
    });
    
    var point = 0;
    test_NPL_round.record.forEach(NPLResponse => {
        if (NPLResponse.content.length === string_size_270k_characters.length) point++;
    });

    if (point > 0) {
        console.log(` --  performNplRound() |           chunk transfer successful: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |         chunk transfer unsuccessful: ❌`);
        return false
    }
}

async function contract(ctx) {
    // NPL-Broker unit test

    // The overall score of this unit test
    var score = 0;

    console.log(`\n npl-broker-js' UNIT TEST (5 tests):`);
    console.log(`    UNL count: ${ctx.unl.count()}\n`);

    // The amount of NPL messages we want in Test #1
    var messageCount = 2;

    // The amount of NPL message we received in Test #1, should be "nplMessageCount == messageCount" for success
    var nplMessageCount = 0;
    const LISTENER_STREAM = (packet) => {
        nplMessageCount++;
    }

    // Initialize npl-broker object
    const NPL = NPLBroker.init(ctx, LISTENER_STREAM);

    // UNIT TEST #1 : using the broker's NPL stream
    const T1 = await testNplStream(NPL, messageCount);

    await delay(1000);
    if (nplMessageCount > 0) {
        console.log(` --  NPL msg stream () |                  NPL stream working: ✅`);
        score++;
    } else {
        console.log(` --  NPL msg stream () |              NPL stream not working: ❌`);
    }

    // UNIT TEST #2 : hitting the correct desiredCount threshold @ performNplRound() 
    const T2 = await testGetDesiredCount(ctx, NPL, "NPLGetDesiredCount", 3000);

    // UNIT TEST #3 : hit an overlapping NPL round to trigger error @ performNplRound()
    const T3 = await testTriggerOverlappingNplRoundError(ctx, NPL, "NPLTriggerOverlappingRound", 1000);

    // UNIT TEST #4 : checksum is valid on sender's side (Content Integrity)
    const T4 = await testGetValidChecksum(ctx, NPL, "NPLGetValidChecksum", 3000)

    // UNIT TEST #5 : enable chunk transfer
    const T5 = await testTriggerChunkTransfer(ctx, NPL, "NPLTriggerChunkTransfer", 5000);

    const tests = [T1, T2, T3, T4, T5];
    tests.forEach(result => {
        if (result) {
            score++;
        }
    })

    console.log(`\n --- UNIT TEST SCORE: ${score} / ${tests.length}\n\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
/**
 * END UNIT TEST
 */
})();

module.exports = __webpack_exports__;
/******/ })()
;