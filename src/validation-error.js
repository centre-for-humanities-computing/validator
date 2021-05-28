
class ValidationError extends Error {

    #path;

    /**
     * @param {string} message the error message
     * @param {string} path the path for the error
     */
    constructor(message, path) {
        super(message);
        this.#path = path
    }

    /**
     * @returns {string} the path of the error
     */
    get path() {
        return this.#path;
    }
}

module.exports = { ValidationError };