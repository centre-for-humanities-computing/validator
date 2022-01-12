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
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('', (person) => person.is.anObject('a person must be an object'); // '' references the object itself
     * ruleSet.addRule('name', (name) => name.fulfillAllOf((name) => [
     *     name.is.aString('"${PATH}" must be a string'),
     *     name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     * ]);
     * ruleSet.addRule('age', (age) => age.optional.is.aNumber('"${PATH}" must be a number'));
     *
     * // add a variable values using the second parameter for the rule. The argument for parameter should be passed in during validation
     * ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} is not a valid zipCode'));
     *
     * @param {string} path the path for the rule. An empty string is considered the default rule.
     * @param {function(Validator, context?:*)} rule the rule which will be called when validating this path. "context" is an optional argument which can be passed in during validation.
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
     * ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} is not a valid zipCode'));
     *
     * let person = { name: "John", age: 43, address: { zip: "8000" }};
     *
     * let zipCodes = ['8000', '9000'];
     * console.log(ruleSet.isValid(person, undefined, zipCodes)); // pass in zipCodes as third argument to use for the 'address.zip' rule
     * console.log(ruleSet.isValid(person, '')); // test only the rule for '' (we don't need to pass in zipCodes here, as zip-codes will not be tested)
     * console.log(ruleSet.isValid(person, ['', 'name'])); // test only the rules for '' and 'name' (we don't need to pass in zipCodes here, as zip-codes will not be tested)
     *
     * @param object the object to validate
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @param {*} [context] a context object which should be passed to the rules
     * @return {boolean}
     * @see {@link #isValueValid}
     * @see {@link #validate}
     * @see {@link #validateValue}
     * @see {@link #addRule}
     */
    isValid(object, path, context) {
        let result = false;
        try {
            result = this.validate(object, path, context).isValid();
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
     * ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} is not a valid zipCode'));
     *
     * let name = 'john';
     * let age = 43;
     * let zip = '8000';
     * let zipCodes = ['8000', '9000'];
     *
     * console.log(ruleSet.isValueValid(name, 'name'));
     * console.log(ruleSet.isValueValid(age, 'age'));
     * console.log(ruleSet.isValueValid(zip, 'address.zip', zipCodes));
     *
     * @param value the value to validate
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
     * @param {*} [context] a context object which should be passed to the rules
     * @return {boolean}
     * @see {@link #isValidObject}
     * @see {@link #validate}
     * @see {@link #validateValue}
     */
    isValueValid(value, path, context) {
        let result = false;
        try {
            result = this.validateValue(value, path, context).isValid();
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
     * ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} is not a valid zipCode'));
     *
     * let person = { name: "John", age: 43, address: { zip: "8000" }};
     * let zipCodes = ['8000', '9000'];
     *
     * let validationResult = ruleSet.validate(person, undefined, zipCodes); // if no rule needed a context (zipCodes in this ex.) we could just call ruleSet.validate(person)
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * // when path(s) is passed in we only get a `ValidationResult` for passed in `path(s)`
     * validationResult = ruleSet.validate(person, 'name');
     *
     * @param object
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the object
     * @param {*} [context] a context object which should be passed to the rules
     * @param {boolean} isObject should be <code>true</code> if the object should be considered an object with "paths" to validate
     * and <code>false</code> if the object is to be considered a single value to validate
     * @returns {ValidationResult}
     * @see {@link #validateValue}
     * @see {@link #isValueValid}
     * @see {@link #isValid}
     */
    validate(object, path = undefined, context, isObject = true) {
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
                rule.rule(test(value, rule.path), context);
            } else {
                rule.rule(test(object, rule.path), context);
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
     * ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} is not a valid zipCode'));
     *
     * let name = 'john';
     * let age = 43;
     * let zip = '8000';
     * let zipCodes = ['8000', '9000'];
     *
     * let validationResult = ruleSet.validate(name, 'name');
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * validationResult = ruleSet.validate(age, 'age');
     * validationResult.validate(zip, 'address.zip', zipCodes);
     *
     * @param value the value to validate against the rule for the path(s)
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
     * @param {*} [context] a context object which should be passed to the rules
     * @returns {ValidationResult}
     */
    validateValue(value, path, context) {
        return this.validate(value, path, context,false);
    }

    static #throwArgumentError(message) {
        throw new Error(`RuleSet usage error: ${message}`);
    }
}

module.exports = { RuleSet };

