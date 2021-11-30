const {ValidatorInternalState} = require("./validator-internal-state");
const _ = require("lodash");

class Debug {

    static indent = Object.freeze({
        NONE: 'none',
        BEGIN: 'begin',
        END: 'end'
    });

    static #instance;

    #indentCount = 0;

    constructor() {

    }

    indent(type) {
        if (type === Debug.indent.BEGIN) {
            this.#indentCount++;
        } else if (type === Debug.indent.END) {
            this.#indentCount--;
        }
    }

    printMessage(icon, message) {
        let messageOut = `${icon}  ${' '.repeat(this.#indentCount * 2)}${message}`;
        console.log(messageOut);
    }

    methodArgsToStr(args) {
        if (args.length > 1) {
            return `[${args.map(arg => this.valueToStr(arg)).join(', ')}]`;
        } else if (args.length === 1) {
            return `[${this.valueToStr(args[0])}]`;
        }
        return '';
    }

    valueToStr(value) {
        if (Array.isArray(value)) {
            return '[Array]';
        } else if (value instanceof Set) {
            return '[Set]';
        } else if (value instanceof Map) {
            return '[Map]';
        } else if (_.isObject(value)) {
            return '[Object]';
        } else if (_.isString(value)) {
            return `"${value}"`;
        }
        return value;
    }

    pathStr(currentPath) {
        return currentPath ? currentPath : 'ROOT';
    }

    /**
     *
     * @returns {Debug}
     */
    static get instance() {
        return Debug.#instance;
    }

    static get enabled() {
        return !!Debug.#instance;
    }

    static enable(enable = true) {
        if (enable) {
            Debug.#instance = new Debug();
        } else {
            Debug.#instance = undefined;
        }
    }

    static disable() {
        Debug.enable(false);
    }

}

module.exports = { Debug };