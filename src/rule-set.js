const _ = require("lodash");
const { Validator } = require('./validator');
const { ValidationResult } = require('./validation-result');


/**
 * Create a set of reusable rules associated with one or more paths.
 */
class RuleSet {

    #errorPrefix;
    #mode;
    #rules = new Map();
    #validatorCreate;

    constructor(errorPrefix, mode, validatorCreate) { // validatorCreate function to handle circular dependencies
        this.#errorPrefix = errorPrefix;
        this.#mode = mode;
        this.#validatorCreate = validatorCreate;
    }

    /**
     *
     * @param {string} path the path for the rule. An empty string is considered the default rule.
     * @param {function(Validator)} rule
     * @returns {RuleSet}
     */
    addRule(path, rule) {
        if (!_.isString(path)) {
            throw new Error("path must be a string");
        }
        if (!rule) {
            throw new Error("Rule cannot be undefined");
        }
        if (this.#rules.has(path)) {
            throw new Error(`Rule for path '${path}' is already defined`);
        }
        this.#rules.set(path, {rule, path});
        return this;
    }

    /**
     * @param object the object to validate
     * @param {string|string[]|undefined} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @return {boolean}
     * @see {@link #isValidValue}
     * @see {@link #validate}
     * @see {@link #validateValue}
     */
    isValid(object, path) {
        return this.validate(object, path).isValid();
    }

    /**
     *
     * @param value the value to validate
     * @param {string|string[]|undefined} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
     * @return {boolean}
     * @see {@link #isValidObject}
     * @see {@link #validate}
     * @see {@link #validateValue}
     */
    isValidValue(value, path) {
        return this.validateValue(value, path).isValid();
    }

    /**
     *
     * @param object
     * @param {string|string[]|undefined} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @param {boolean} isObject should be <code>true</code> if the object should be considered an object with "paths" to validate
     * and <code>false</code> if the object is to be considered a single value to validate
     * @returns {ValidationResult}
     * @see {@link #validateValue}
     * @see {@link #idValidValue}
     * @see {@link #isValidObject}
     */
    validate(object, path = undefined, isObject = true) {
        let rules;
        if (path === undefined) { // validate all
            rules = Array.from(this.#rules.values());
        } else {
            rules = [];
            if (!Array.isArray(path)) {
                path = [path];
            }
            for (let p of path) {
                let rule = this.#rules.get(p);
                if (!rule) {
                    RuleSet.#throwArgumentError(`No rule added for the path "${path}"`);
                }
                rules.push(this.#rules.get(p));
            }
        }

        let test = this.#validatorCreate(this.#errorPrefix, this.#mode);

        for (let rule of rules) {
            if (isObject && rule.path) {
                let value = object[rule.path];
                if (value === undefined) { // lodash get() is a little slow, so only use it if needed
                    value = _.get(object, rule.path);
                }
                rule.rule(test(value, rule.path));
            } else {
                rule.rule(test(object));
            }
        }
        return test.result;
    }

    /**
     * @param value the value to validate against the rule for the path
     * @param path the path for the rule to validate against
     * @returns {ValidationResult}
     */
    validateValue(value, path) {
        return this.validate(value, path, false);
    }

    static #throwArgumentError(message) {
        throw new Error(`RuleSet usage error: ${message}`);
    }
}

module.exports = { RuleSet };