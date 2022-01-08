const _ = require("lodash");
const { ValidationResult } = require('./validation-result');
const { ValidationError } = require('./validation-error');
const { Validator } = require('./validator');
/**
 * Create a set of reusable rules associated with one or more paths.
 */
class RuleSet {

    #errorPrefix;
    #mode;
    #rules = new Map();

    constructor(errorPrefix, mode) {
        this.#errorPrefix = errorPrefix;
        this.#mode = mode;
    }

    /**
     * @example
     *
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('', (person) => person.is.anObject('a person must be an object'); // '' references the object itself
     * ruleSet.addRule('name', (name) => name.fulfillAllOf((name) => [
     *     name.is.aString('"${PATH}" must be a string'),
     *     name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     * ]);
     * ruleSet.addRule('age', (age) => age.optional.is.aNumber('"${PATH}" must be a number'));
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
     * Test if the property paths of the object is valid. In the case of an `ValidationError` <code>false</code> will be returned.
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('', (person) => person.is.anObject('a person must be an object');
     * ruleSet.addRule('name', (name) => name.is.aString('"${PATH}" must be a string');
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number');
     *
     * let person = { name: "John", age: 43 };
     *
     * console.log(ruleSet.isValid(person));
     * console.log(ruleSet.isValid(person, '')); // test only the rule for ''
     * console.log(ruleSet.isValid(person, ['', 'name'])); // test only the rules for '' and 'name'
     *
     * @param object the object to validate
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @return {boolean}
     * @see {@link #isValueValid}
     * @see {@link #validate}
     * @see {@link #validateValue}
     */
    isValid(object, path) {
        let result = false;
        try {
            result = this.validate(object, path).isValid();
        } catch (e) {
            if (!(e instanceof ValidationError)) {
                throw e;
            }
        }
        return result;
    }

    /**
     * Test if the value is valid. In the case of an `ValidationError` <code>false</code> will be returned.
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     *
     * ruleSet.addRule('name', (name) => name.fulfillAllOf((name) => [
     *     name.is.aString('"${PATH}" must be a string'),
     *     name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     * ]);
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number'));
     *
     * let name = 'john';
     * let age = 43;
     *
     * console.log(ruleSet.isValueValid(name, 'name'));
     * console.log(ruleSet.isValueValid(age, 'age'));
     *
     * @param value the value to validate
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
     * @return {boolean}
     * @see {@link #isValidObject}
     * @see {@link #validate}
     * @see {@link #validateValue}
     */
    isValueValid(value, path) {
        let result = false;
        try {
            result = this.validateValue(value, path).isValid();
        } catch (e) {
            if (!(e instanceof ValidationError)) {
                throw e;
            }
        }
        return result;
    }

    /**
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('', (person) => person.is.anObject('a person must be an object');
     * ruleSet.addRule('name', (name) => name.is.aString('"${PATH}" must be a string');
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number');
     *
     * let person = { name: "John", age: 43 };
     *
     * let validationResult = ruleSet.validate(person);
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * // when path(s) is passed in we only get a `ValidationResult` for passed in `path(s)`
     * validationResult = ruleSet.validate(person, 'name');
     *
     * @param object
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @param {boolean} isObject should be <code>true</code> if the object should be considered an object with "paths" to validate
     * and <code>false</code> if the object is to be considered a single value to validate
     * @returns {ValidationResult}
     * @see {@link #validateValue}
     * @see {@link #isValueValid}
     * @see {@link #isValid}
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

        let test = Validator.create(this.#errorPrefix, this.#mode);

        for (let rule of rules) {
            if (isObject && rule.path) {
                let value = object[rule.path];
                if (value === undefined) { // lodash get() is a little slow, so only use it if needed
                    value = _.get(object, rule.path);
                }
                rule.rule(test(value, rule.path));
            } else {
                rule.rule(test(object, rule.path));
            }
        }
        return test.result;
    }

    /**
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('name', (name) => name.is.aString('"${PATH}" must be a string');
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number');
     *
     * let name = 'john';
     * let age = 43;
     *
     * let validationResult = ruleSet.validate(name, 'name');
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * validationResult = ruleSet.validate(age, 'age');
     *
     * @param value the value to validate against the rule for the path(s)
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
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

