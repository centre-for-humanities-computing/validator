import _ from 'lodash';
import { ValidationResult } from './validation-result.js';
import { ValidationError } from './validation-error.js';
import { Validator } from './validator.js';
import { isString } from './type-predicates.js';

/**
 * A set of reusable rules associated with one or more paths.
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
     * // Values not known at the time the rule is created can be referenced by the second parameter "context".
     * // The argument for "context" should then be passed in during validation.
     * ruleSet.addRule('country', (country, acceptedCountries) => country.isNot.in(acceptedCountries, "${VALUE} is not current on our list if countries"));
     *
     * @param {string} path the path for the rule. An empty string is considered the default rule.
     * @param {function(Validator, context?:*)} rule the rule which will be called when validating this path. "context" is an optional argument that can be passed in during validation.
     * @returns {RuleSet}
     */
    addRule(path, rule) {
        if (!isString(path)) {
            throw new Error("path must be a string");
        }
        if (!rule) {
            throw new Error("Rule cannot be undefined");
        }
        if (this.#rules.has(path)) {
            throw new Error(`Rule for path '${path}' is already defined`);
        }
        this.#rules.set(path, { rule, path });
        return this;
    }

    /**
     * Test if the property paths of the object are valid. In the case of a `ValidationError` `false` will be returned.
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('', (person) => person.is.anObject('a person must be an object');
     * ruleSet.addRule('name', (name) => name.is.aString('"${PATH}" must be a string');
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number');
     * ruleSet.addRule('country', (country, acceptedCountries) => country.isNot.in(acceptedCountries, "${VALUE} is not current on our list if countries"));
     *
     * let person = { name: "John", age: 43, country: 'Denmark'};
     * let acceptedCountries = ['Denmark', 'Japan'];
     *
     * console.log(ruleSet.isValid(person, undefined, acceptedCountries)); // pass in acceptedCountries as third argument to use for the 'country' rule
     * console.log(ruleSet.isValid(person, '')); // test only the rule for '' (we don't need to pass in acceptedCountries here, as country will not be tested)
     * console.log(ruleSet.isValid(person, ['', 'name'])); // test only the rules for '' and 'name' (we don't need to pass in acceptedCountries here, as country will not be tested)
     *
     * @param object the object to validate
     * @param {string|string[]} [path] the path(s) to validate. If the path is undefined all rules will be validated against the object
     * @param {*} [context] a context object which should be passed to the rules
     * @return {boolean}
     * @see isValueValid
     * @see validate
     * @see validateValue
     * @see addRule
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
     * Test if the value is valid. In the case of a `ValidationError` `false` will be returned.
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     *
     * ruleSet.addRule('name', (name) => name.fulfillAllOf((name) => [
     *     name.is.aString('"${PATH}" must be a string'),
     *     name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     * ]);
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number'));
     * ruleSet.addRule('country', (country, acceptedCountries) => country.isNot.in(acceptedCountries, "${VALUE} is not current on our list if countries"));
     *
     * let name = 'john';
     * let age = 43;
     * let country = 'Denmark';
     * let acceptedCountries = ['Denmark', 'Japan'];
     *
     * console.log(ruleSet.isValueValid(name, 'name'));
     * console.log(ruleSet.isValueValid(age, 'age'));
     * console.log(ruleSet.isValueValid(country, 'country', acceptedCountries));
     *
     * @param value the value to validate
     * @param {string|string[]} [path] the path(s) to validate. If path is undefined all rules will be validated against the value
     * @param {*} [context] a context object which should be passed to the rules
     * @return {boolean}
     * @see isValidObject
     * @see validate
     * @see validateValue
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
     * ruleSet.addRule('country', (country, acceptedCountries) => country.isNot.in(acceptedCountries, "${VALUE} is not current on our list if countries"));
     *
     * let person = { name: "John", age: 43, country: 'Denmark'};
     * let acceptedCountries = ['Denmark', 'Japan'];
     *
     * let validationResult = ruleSet.validate(person, undefined, acceptedCountries); // if "context" is not needed (acceptedCountries in this ex.), we could just call ruleSet.validate(person)
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
     * @param {boolean} isObject should be `true` if the object should be considered an object with "paths" to validate
     * and `false` if the object is to be considered a single value to validate
     * @returns {ValidationResult}
     * @see validateValue
     * @see isValueValid
     * @see isValid
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

        return Validator.validationResult(test);
    }

    /**
     *
     * @example
     * let ruleSet = Validator.createOnErrorNextPathRuleSet();
     * ruleSet.addRule('name', (name) => name.is.aString('"${PATH}" must be a string');
     * ruleSet.addRule('age', (age) => age.is.aNumber('"${PATH}" must be a number');
     * ruleSet.addRule('country', (country, acceptedCountries) => country.isNot.in(acceptedCountries, "${VALUE} is not current on our list if countries"));
     *
     * let name = 'john';
     * let age = 43;
     * let country = 'Denmark';
     * let acceptedCountries = ['Denmark', 'Japan'];
     *
     * let validationResult = ruleSet.validate(name, 'name');
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * validationResult = ruleSet.validate(age, 'age');
     * validationResult.validate(country, 'country', countries);
     *
     * @param value the value to validate against the rule for the path(s)
     * @param {string|string[]} [path] the path(s) to validate. If the path is `undefined,` all rules will be validated against the value
     * @param {*} [context] a context object which should be passed to the rules
     * @returns {ValidationResult}
     */
    validateValue(value, path, context) {
        return this.validate(value, path, context, false);
    }

    static #throwArgumentError(message) {
        throw new Error(`RuleSet usage error: ${message}`);
    }
}

export { RuleSet };

