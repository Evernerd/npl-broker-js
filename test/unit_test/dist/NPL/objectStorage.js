let _object = null;

/**
 * Get the NPLBroker instance
 * 
 * @returns {object}
 */
function get() {
    return _object
}

/**
 * Set the NPLBroker instance
 * 
 * @param {object} object The NPLBroker instance
 * @returns {object}
 */
function set(object) {
    if (_object === null) {
        _object = object;
    }
}

module.exports = {
    get,
    set
}