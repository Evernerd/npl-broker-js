/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 277:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const EventEmitter = __nccwpck_require__(361);

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

/***/ }),

/***/ 875:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 294:
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
    contractEnd: "contract_end",
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

/***/ 23:
/***/ ((__unused_webpack_module, __webpack_exports__, __nccwpck_require2_) => {

"use strict";
// ESM COMPAT FLAG
__nccwpck_require2_.r(__webpack_exports__);

// EXPORTS
__nccwpck_require2_.d(__webpack_exports__, {
  "HotPocketContract": () => (/* binding */ HotPocketContract)
});

// EXTERNAL MODULE: ./src/common.js
var common = __nccwpck_require2_(294);
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

        this.#readStream = npl_fs.createReadStream(null, { fd: this.#fd, highWaterMark: common.constants.MAX_SEQ_PACKET_SIZE });

        // From the hotpocket when sending the npl messages first it sends the public key of the particular node
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

    init(contractFunc, clientProtocol = common.clientProtocols.json) {

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
        this.#controlChannel.send({ type: common.controlMessages.contractEnd });
        this.#controlChannel.close();
    }
}

/***/ }),

/***/ 364:
/***/ ((module, __unused_webpack_exports, __nccwpck_require2_) => {

const { clientProtocols, constants } = __nccwpck_require2_(294);
const { HotPocketContract } = __nccwpck_require2_(23);

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
/******/ 	var __webpack_exports__ = __nccwpck_require2_(364);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;

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
const HotPocket = __nccwpck_require__(875);
const NPLBroker = __nccwpck_require__(277);

async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

async function testGetDesiredCount(ctx, NPL, listener, roundName, timeout, maxListeners) {
    var nplRoundscore = 0;
    for (let x = 0; x < ctx.unl.count(); x++) {
        if (x+1 < maxListeners) {
            NPL.subscribeRound(roundName, listener);        
        }
        
        const start = performance.now();
        const test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count() - x,
            timeout: timeout
        });

        const timeTaken = performance.now() - start;

        await delay(timeout - timeTaken);

        if (test_NPL_round.desiredCountReached) { nplRoundscore++; }
    }
    if (nplRoundscore === ctx.unl.count()) {
        console.log(` --  performNplRound() |              desiredCount threshold: ✅`);
        return true;
    } else {
        return false;
    }
}

async function testHitSubscriberLimitPNR(ctx, NPL, listener, roundName, timeout, maxListeners) {
    try {
        NPL.subscribeRound(roundName, listener);        

        const _test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });
    } catch (err) {
        if (err.toString() === `Error: roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${maxListeners}!`) {
            console.log(` --  performNplRound() |                    subscriber limit: ✅`);
            return true;
        }
    }
    return false;
}

async function testHitSubscriberLimitSR(NPL, listener, roundName, maxListeners) {
    try {
        NPL.subscribeRound(roundName, listener);
    } catch (err) {
        if (err.toString() === `Error: roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${maxListeners}!`) {
            console.log(` --   subscribeRound() |                    subscriber limit: ✅`);
            return true;
        }
    }
    return false;
}

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
    } catch (err) {
        // error is unique -> [ CRITICAL - ${packet.node} sent more than 1 response in NPL round "${roundName}" ] 
        console.log(` --  performNplRound() |       avoided overlapping NPL round: ✅`)
        return true;
    }
    return false;
}

async function contract(ctx) {
    // NPL-Broker unit test

    // variables
    const mode = "public";
    const roundName = "testNplBroker";
    const maxListeners = 2;
    const timeout = 300;
    var score = 0;

    console.log(`\n npl-broker-js' UNIT TEST (4 tests):`);
    console.log(`         MODE: ${mode}`);
    console.log(`    UNL count: ${ctx.unl.count()}`);
    console.log(` Max Listener: ${maxListeners}\n`);

    // initialize npl-broker class
    const NPL = NPLBroker.init({
        mode: mode,
        maxListeners: maxListeners,
        ctx: ctx
    });

    const listener = (packet) => {
        // this is an independent event (NPL round) listener!
        // console.log(`NODE: ${packet.node}`);
        // console.log(`CONTENT: ${packet.content}\n`);
        13+37;
    }
    
    // UNIT TEST #1 : hitting the correct desiredCount threshold @ performNplRound() 
    const T1 = await testGetDesiredCount(ctx, NPL, listener, roundName, timeout, maxListeners);

    // UNIT TEST #2 : hitting the subscriber (listener) limit @ performNplRound(). PNR
    const T2 = await testHitSubscriberLimitPNR(ctx, NPL, listener, roundName, timeout, maxListeners);

    // UNIT TEST #3 : hitting the subscriber (listener) limit @ subscribeRound(). SR
    const T3 = await testHitSubscriberLimitSR(NPL, listener, roundName, maxListeners);

    // UNIT TEST #4 : hit an overlapping NPL round to trigger error @ performNplRound()
    const T4 = await testTriggerOverlappingNplRoundError(ctx, NPL, roundName, timeout);

    const tests = [T1, T2, T3, T4];
    tests.forEach(test => {
        if (test) {
            score++;
        }
    })

    console.log(`\n --- UNIT TEST SCORE: ${score} / ${tests.length}`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
})();

module.exports = __webpack_exports__;
/******/ })()
;