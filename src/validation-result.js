
class ValidationResult {

    #errors = new Map();

    /**
     * Get the first error for the given path
     *
     * @param {string} [path=""] the path to get the error for, the path must be relative to the root object under validation
     * @returns {string|undefined}
     */
    getError(path = "") {
        return this.getErrors(path)[0];
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

// TODO
// use in validator etc for the different modes
// ved test igen i de forskellige modes, hvis man ikke resetter bygger den bare ovenpå, og ved throw og break tilføjer den en enkelt ny error
// osv. Ved next Path tilføjer den ny for hver path...
// dokumenter dette
// dokumenter de forskellige modes..
// dokumenter a test funktionen har en result property (jsdoc, so kan content assist)
// lav conditionally
// lav README, med eksempler
// put på npm og brug i de to projekter...

// lav eksempler på brug af den nye feature jeg er ved at lave hvor man i test(value, "path.path") kan give en path med som prefixes
// i ${PATH} og i ValidationResult messages, så kan man lave mange små tests efter hinanden af værdier uafhængige af hinanden og stadig holde styr på dem
// let a = 3;
// let b = 4;
/*
* test(a, 'a')...
* test(b, 'b')...
* */

/*
* omskriv eks. for fulfill, fulfullOneOf fulfillAllOf, så de matcher den typiske brug og der tages højde for forskellige modes. også i create() delen af eks.
*
* Lav meget simpel README. med install instructions og et par eksempler, og så smid på NPM
* */


module.exports = { ValidationResult };