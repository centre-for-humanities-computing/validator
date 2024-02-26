const { isMap, isObject, isSet, isString } = require('./type-predicates');

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
        } else if (isSet(value)) {
            return '[Set]';
        } else if (isMap(value)) {
            return '[Map]';
        } else if (isObject(value)) {
            return '[Object]';
        } else if (isString(value)) {
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