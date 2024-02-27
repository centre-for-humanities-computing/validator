class ValidationError extends Error {

    #path;

    /**
     * @param {string} message - The error message.
     * @param {string} path The path for the error.
     */
    constructor(message, path) {
        super(message);
        this.#path = path;
    }

    /**
     * @returns {string} The path of the error.
     */
    get path() {
        return this.#path;
    }
}

export { ValidationError };