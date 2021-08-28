
class ValidationResult {

    #errors = new Map();

    /**
     * Get the first error for the given path.
     * <p>If no error message is provided for the tests use {@link isValid} or {@link isPathValid} instead.</p>
     *
     * @param {string} [path=""] the path to get the error for, the path must be relative to the root object under validation
     * @returns {string|undefined}
     * @see isValid
     * @see isPathValid
     */
    getError(path = "") {
        return this.getErrors(path)[0];
    }

    /**
     * Get the all error for the given path.
     * <p>If no error message is provided for the tests use {@link isValid} or {@link isPathValid} instead.</p>
     *
     * @param {string} [path=""] the path to get the error for, the path must be relative to the root object under validation
     * @returns {string[]}
     * @see isValid
     * @see isPathValid
     */
    getErrors(path = "") {
        let errors = this.#errors.get(path);
        if (!errors) {
            return [];
        } else {
            return [...errors]; // copy to new array to prevent external modification
        }
    }

    /**
     * Get all errors for all paths.
     * <p>If no error message is provided for the tests use {@link isValid} or {@link isPathValid} instead.</p>
     *
     * @returns {string[]}
     * @see isValid
     * @see isPathValid
     */
    getAllErrors() {
        let allErrors = [];
        for (let errors of this.#errors.values()) {
            allErrors.push(...errors);
        }
        return allErrors;
    }

    /**
     * Test if everything is valid.
     * This does purely rely on if all tests passed or not and not whether an error message was supplied.
     *
     * @returns {boolean} <code>true</code> if no errors otherwise <code>false</code>
     */
    isValid() {
        return this.#errors.size === 0;
    }

    /**
     * Test if the given path is valid.
     * This does purely rely on if all tests passed or not and not whether an error message was supplied.
     *
     * @param {string} path the path to test if valid, the path must be relative to the root object under validation
     * @returns {boolean} <code>true</code> if no errors for the given path otherwise <code>false</code>
     */
    isPathValid(path) {
        return !this.#errors.has(path);
    }

    reset() {
        this.#errors.clear();
    }

    /**
     * @param path
     * @param message
     * @private
     */
    _addFailedPath(path, message) {
        if (!this.#errors.has(path)) {
            this.#errors.set(path, []);
        }
        if (message) {
            this.#errors.get(path).push(message);
        }
    }

}

module.exports = { ValidationResult };