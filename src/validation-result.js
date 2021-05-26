
class ValidationResult {

    #errors = new Map();

    /**
     * Get the first error for the given path
     *
     * @param {string} [path=""] the path to get the error for, the path must be relative to the root object under validation
     * @returns {string|undefined}
     */
    getError(path = "") {
        return this.getErrors()[0];
    }

    /**
     * Get the all error for the given path
     *
     * @param {string} [path=""] the path to get the error for, the path must be relative to the root object under validation
     * @returns {string[]}
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
     * Get all errors for all paths
     *
     * @returns {string[]}
     */
    getAllErrors() {
        let allErrors = [];
        for (let errors of this.#errors.values()) {
            allErrors.push(...errors);
        }
        return allErrors;
    }

    /**
     * Test if everything is valid
     *
     * @returns {boolean} <code>true</code> if no errors otherwise <code>false</code>
     */
    isValid() {
        return this.#errors.size === 0;
    }

    /**
     * Test if the given path is valid
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

    _addError(path, message) {
        if (!this.#errors.has(path)) {
            this.#errors.set(path, []);
        }
        this.#errors.get(path).push(message);
    }

}

// TODO
// use in validator etc for the different modes
// ved test igen i de forskellige modes, hvis man ikke resetter bygger den bare ovenpå, the ved throw og break tilføjer den en ny error
// osv. Ved next Path tilføjer den ny for hver path...
// dokumenter dette
// dokumenter de forskellige modes..
// dokumenter a test funktionen har en result property (jsdoc, so kan content assist)

module.exports = { ValidationResult };