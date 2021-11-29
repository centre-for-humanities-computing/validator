const utils = require('./utils');

class ValidatorInternalState {

    static debug;

    static debugIndent = Object.freeze({
        NONE: 'none',
        BEGIN: 'begin',
        END: 'end'
    });

    #name;
    #mode;
    #contextValue;
    #contextValuePath;
    #contextValueCurrentPath;
    #errorPrefix;
    #errorBasePath;
    #validationResult;

    constructor(name) {
        this.#name = name;
    }

    _init(mode, contextValue, contextValuePath, contextValueCurrentPath, errorPrefix, errorBasePath, validationResult) {
        this.#mode = mode;
        this.#contextValue = contextValue;
        this.#contextValuePath = contextValuePath;
        this.#contextValueCurrentPath = contextValueCurrentPath;
        this.#errorPrefix = errorPrefix;
        this.#errorBasePath = errorBasePath;
        this.#validationResult = validationResult;
    }

    get mode() {
        return this.#mode;
    }

    get contextValue() {
        return this.#contextValue;
    }

    get contextValuePath() {
        return this.#contextValuePath;
    }

    get contextValueCurrentPath() {
        return this.#contextValueCurrentPath;
    }

    get errorPrefix() {
        return this.#errorPrefix;
    }

    get errorBasePath() {
        return this.#errorBasePath;
    }

    /**
     *
     * @returns {string} the contextValuePath prefixed with errorBasePath (if set)
     */
    get errorContextValuePath() {
        return utils.joinPropPaths(this.#errorBasePath, this.#contextValuePath);
    }

    get validationResult() {
        return this.#validationResult;
    }

    getFullErrorMessage(errorMessage) {
        let fullMessage = errorMessage;
        if (this.#errorPrefix) {
            fullMessage = `${this.#errorPrefix} ${errorMessage}`;
        }
        return fullMessage;
    }

    /**
     * @param {ValidatorInternalState} the dest to clone to
     * @param {string} contextValue the contextValue for the clone
     * @param {string} [contextValuePath] the contextValuePath for the clone, if <code>undefined</code> the contextValuePath from this instance will be used
     * @param {string} [contextValueCurrentPath] the contextValueCurrentPath for the clone, if <code>undefined</code> the contextValueCurrentPath from this instance will be used
     * @returns {ValidatorInternalState}
     */
    cloneWith(dest, contextValue, contextValuePath, contextValueCurrentPath) {
        contextValuePath = contextValuePath === undefined ? this.#contextValuePath : contextValuePath;
        contextValueCurrentPath = contextValueCurrentPath === undefined ? this.#contextValueCurrentPath : contextValueCurrentPath;
        dest._init(this.mode, contextValue, contextValuePath, contextValueCurrentPath, this.errorPrefix, this.errorBasePath, this.validationResult);
        return dest;
    }

    static toggleDebug(debug) {
        if (debug) {
            debug.indent = 0;
        }
        ValidatorInternalState.debug = debug;
    }

}

module.exports = { ValidatorInternalState };