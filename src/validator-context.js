const _ = require('lodash');
const { ValidationInternalState } = require('./validator-internal-state');
const { ValidationError } = require('./validation-error');
const sharedConstants = require('./shared-constants');
const utils = require('./utils');

const INTEGER_STRING_PATTERN = /^-?\d+$/;
const FLOAT_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

// a ${NUMBER} not preceded by a \ (so we can escape placeholders)
const PLACEHOLDER_PRE_TEST_PATTERN = /(?<!\\)\${.+?}/;
const PLACEHOLDER_PATTERN = /(?<!\\)\${(\d+)}/g;
const PLACEHOLDER_CONTEXT_VALUE_PATTERN = /(?<!\\)\${VALUE}/g;
const PLACEHOLDER_CONTEXT_PATH_PATTERN = /(?<!\\)\${PATH}/g;
const PLACEHOLDER_CONTEXT_CURRENT_PATH_PATTERN = /(?<!\\)\${CURRENT_PATH}/g;
const PLACEHOLDER_CONTEXT_PARENT_PATH_PATTERN = /(?<!\\)\${PARENT_PATH}/g;

class ValidatorContext {

    #name;
    #validator;
    #validatorState;
    #notContext;
    #validatorCallbackContext;

    constructor(name) {
        this.#name = name;
    }

    /**
     * @param {Validator} validator
     * @param {ValidatorInternalState} validatorState
     * @param {boolean} notContext
     * @param {object} validatorCallbackContext
     * @private
     */
    _init(validator, validatorState, notContext, validatorCallbackContext) {
        this.#validator = validator;
        this.#validatorState = validatorState;
        this.#notContext = notContext;
        this.#validatorCallbackContext = validatorCallbackContext;
    }

    /**
     * @private
     */
    _reset() {
        this.#validator = undefined;
        this.#validatorState = undefined;
        this.#notContext = undefined;
        this.#validatorCallbackContext = undefined;
    }

    get #contextValue() {
        return this.#validatorState.contextValue;
    }

    get #contextValuePath() {
        return this.#validatorState.contextValuePath;
    }

    get #contextValueCurrentPath() {
        return this.#validatorState.contextValueCurrentPath;
    }

    get #errorContextValuePath() {
        return this.#validatorState.errorContextValuePath;
    }

    /**
     * @param {*} otherValue the value to compare this value to using strict comparison (===).
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    identicalTo(otherValue, errorMessage, messageArgs) {
        let result = this.#contextValue === otherValue;
        if (ValidationInternalState.debug) {
            this.#printDebug(this.identicalTo.name, result, [otherValue]);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * @param {*} otherValue the value to compare this value to. For complex types like objects, arrays, sets, maps etc. a deep comparison is performed.
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     * @see {@link https://lodash.com/docs/4.17.15#isEqual}
     */
    equalTo(otherValue, errorMessage, messageArgs) {
        let result = _.isEqual(this.#contextValue, otherValue);
        if (ValidationInternalState.debug) {
            this.#printDebug(this.equalTo.name, result, [otherValue]);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    nil(errorMessage, messageArgs) {
        let result = _.isNil(this.#contextValue);
        if (ValidationInternalState.debug) {
            this.#printDebug(this.nil.name, result);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    anArray(errorMessage, messageArgs) {
        let result = Array.isArray(this.#contextValue);
        if (ValidationInternalState.debug) {
            this.#printDebug(this.anArray.name, result);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    aBoolean(errorMessage, messageArgs) {
        let result = _.isBoolean(this.#contextValue);
        if (ValidationInternalState.debug) {
            this.#printDebug(this.aBoolean.name, result);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * A string representing an float
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    aFloatString(errorMessage, messageArgs) {
        let result = _.isString(this.#contextValue) && FLOAT_STRING_PATTERN.test(this.#contextValue);
        if (ValidationInternalState.debug) {
            this.#printDebug(this.aFloatString.name, result);
        }
        return this.#handleError(result, errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    anInteger(errorMessage, messageArgs) {
        return this.#handleError(_.isInteger(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * A string representing an integer
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    anIntegerString(errorMessage, messageArgs) {
        return this.#handleError(_.isString(this.#contextValue) && INTEGER_STRING_PATTERN.test(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    aNumber(errorMessage, messageArgs) {
        return this.#handleError(_.isNumber(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    anObject(errorMessage, messageArgs) {
        return this.#handleError(_.isObject(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    aString(errorMessage, messageArgs) {
        return this.#handleError(_.isString(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    empty(errorMessage, messageArgs) {
        return this.#handleError(_.isEmpty(this.#contextValue), errorMessage, messageArgs);
    }

    /**
     * @param {number} value the value this value should be less than
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    lessThan(value, errorMessage, messageArgs) {
        if (!_.isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = _.isNumber(this.#contextValue) && this.#contextValue < value;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {number} value the value this value should be less than or equal to
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    lessThanOrEqualTo(value, errorMessage, messageArgs) {
        if (!_.isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = _.isNumber(this.#contextValue) && this.#contextValue <= value;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {number} value the value this value should be greater than
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    greaterThan(value, errorMessage, messageArgs) {
        if (!_.isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = _.isNumber(this.#contextValue) && this.#contextValue > value;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {number} value the value this value should be greater than or equal to
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    greaterThanOrEqualTo(value, errorMessage, messageArgs) {
        if (!_.isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = _.isNumber(this.#contextValue) && this.#contextValue >= value;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {number} start the range start (inclusive)
     * @param {number} end the range end (inclusive)
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    inRange(start, end, errorMessage, messageArgs) {
        if (!_.isNumber(start) || !_.isNumber(end)) {
            this.#throwArgumentError(`The arguments for "start" and "end" must both be numbers but was: start="${start}", end="${end}"`);
        }
        let success = _.isNumber(this.#contextValue) && this.#contextValue >= start && this.#contextValue <= end;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {*[]|Set<*>} values an array or Set of values to test against
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    in(values, errorMessage, messageArgs) {
        if (!Array.isArray(values) && !_.isSet(values)) {
            this.#throwArgumentError(`The argument for "values" must be an array or a Set but was: "${typeof values}"`);
        }
        let success = false;
        if (Array.isArray(values)) {
            for (let possibleValue of values) {
                success = (this.#contextValue === possibleValue);
                if (success) {
                    break;
                }
            }
        } else { // must be a Set
            success = values.has(this.#contextValue);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @example
     * let test = Validator.create('Validation error:');
     * let name = "John";
     * // user defined predicate
     * test(name).fulfill((name) => name.is.aString() && name.value.length > 1, 'Name must be a string and must have length > 1');
     * // using the existing validator context.
     * test(name).does.fulfill((name) => name.is.aString(), 'Name must be a string');
     *
     * // OBS we can add a general error message which relates to the full predicate test. If so it is important not
     * // to pass in an error message to the inner predicates because they would then throw an error or break depending on the mode of the validator
     *
     * @param {function(Validator)|boolean} predicate a predicate function which returns a boolean or the results of a predicate. Use the passed in validator context to get access to the predicates of this validator
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    fulfill(predicate, errorMessage, messageArgs) {
        let success = _.isFunction(predicate) ? predicate(this.#validator) : !!predicate;
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     *
     * @example
     * let test = Validator.create('Validation error:');
     * let name = "John";
     * test(name).fulfillOneOf((name) => [
     *     () => name.value.length > 1,    // user defined predicate
     *     () => name.does.match(/\W+/)    // using the existing validator context
     * ], 'Name must have length > 1 or not include \w characters');
     *
     * // combining multiple tests. We don't even need to pass in an initial value
     * test().fulfillOneOf([
     *     () => test(name.length).is.aNumber(), // create a new test and include the boolean result
     *     () => test(name).does.match(/\W+/),   // create a new test and include the boolean result
     *     () => 2 > 1,                    // anything evaluating to a boolean is fine
     *     () => true
     * ], 'weird validation did not pass');
     *
     * // OBS it is important not to pass in an error message to the inner predicates because they would then
     * // throw an error or break depending on the mode of the validator and the remaining predicates would not be tested,
     * // which they should in fulfillOnOf
     *
     * // OBS OBS for short circuit on a false predicate to work as expected (no more predicates are tested after a predicate resolves to true)
     * // each predicate should either be a function or the result of a call to a method of a ValidatorContext
     *
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates  an array of predicate functions, or a function returning an array of predicate functions or predicate results
     * of, predicate functions returning a boolean.
     * Use the passed in validator to add further predicates for the current value
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     * @see {@link #fulfill}, {@link #fulfillAllOf}
     */
    fulfillOneOf(predicates, errorMessage, messageArgs) {
        this.#validatorCallbackContext.enableShortCircuitStickyOn(true);
        if (_.isFunction(predicates)) {
            predicates = predicates(this.#validator);
        }
        if (!Array.isArray(predicates)) {
            this.#throwArgumentError(`The argument "predicates" must be an array or a function returning an array`);
        }
        let success = false;
        for (let predicate of predicates) {
            if (_.isFunction(predicate)) {
                success = predicate(this.#validator);
            } else {
                success = !!predicate;
            }

            if (success) {
                break;
            }
        }
        this.#validatorCallbackContext.disableShortCircuitSticky();
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @example
     * let test = Validator.create('Validation error:', Validator.mode.ON_ERROR_BREAK);
     * let name = "John";
     * test(name).fulfillAllOf(name) => [
     *     () => name.is.aString(),
     *     () => name.is.equalTo("John")
     * ], 'Name must be a string and have the value "John"');
     *
     * // combining multiple tests. We don't even need to pass in an initial value
     * test().fulfillOneOf([
     *     () => test(name.length).is.aNumber(), // create a new test and include the boolean result
     *     () => test(name).does.match(/\W+/),   // create a new test and include the boolean result
     *     () => 2 > 1,                    // anything evaluating to a boolean is fine
     *     () => true
     * ], 'weird validation did not pass');
     *
     * // OBS we can add a general error message which relates to all tests in the array. If so it is important not
     * // to pass in an error message to the inner predicates because they would then throw an error or break depending on the mode of the validator
     *
     * // OBS OBS for short circuit on a false predicate to work as expected (no more predicates are tested after a predicate resolves to true)
     * // each predicate should either be a function or the result of a call to a method of a ValidatorContext
     *
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates an array of, or a function returning an array
     * of, predicate functions returning a boolean.
     * Use the passed in validator to add further predicates for the current value
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     * @see {@link #fulfill}, {@link #fulfillOneOf}
     */
    fulfillAllOf(predicates, errorMessage, messageArgs) {
        this.#validatorCallbackContext.enableShortCircuitStickyOn(false);
        if (_.isFunction(predicates)) {
            predicates = predicates(this.#validator);
        }
        if (!Array.isArray(predicates)) {
            this.#throwArgumentError(`The argument "predicates" must be an array or a function returning an array`);
        }
        let success = true;
        for (let predicate of predicates) {
            if (_.isFunction(predicate)) {
                success = predicate(this.#validator);
            } else {
                success = !!predicate;
            }
            // on mode = ON_ERROR_NEXT_PATH we need to let the validator handle it so it can collect errors for all paths (not required in fulfillOneOf as it only needs to fulfill one predicate)
            if (!success && this.#validatorState.mode !== sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                break;
            }
        }
        this.#validatorCallbackContext.disableShortCircuitSticky();
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {RegExp} regex the regular expression to test the value against
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs] values for placeholders in the errorMessage
     * @returns {boolean} the result of the predicate
     */
    match(regex, errorMessage, messageArgs) {
        if (!(regex instanceof RegExp)) {
            this.#throwArgumentError(`The argument "regex" must be an instance of RegEx but was: "${regex}"`);
        }
        let success = regex.test(this.#contextValue);
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {boolean} success
     * @param {string} [errorMessage] the error message. If defined and the result is false an error with the message will be thrown
     * @param {string|number|(string|number)[]} [messageArgs]
     * @return {boolean}
     */
    #handleError(success, errorMessage, messageArgs = []) {
        if (this.#notContext) {
            success = !success;
        }
        if (!success && !Array.isArray(messageArgs)) {
            messageArgs = [messageArgs];
        }

        let fullMessage;

        try {
            if (!success && errorMessage !== undefined) {
                fullMessage = this.#validatorState.getFullErrorMessage(errorMessage);

                if (messageArgs.length > 0 || fullMessage.match(PLACEHOLDER_PRE_TEST_PATTERN)) {
                    fullMessage = fullMessage.replace(PLACEHOLDER_PATTERN, (match, group1) => messageArgs[group1] + ''); // make sure we return a string
                    fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_VALUE_PATTERN, this.#contextValue);
                    if (this.#errorContextValuePath) {
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_PATH_PATTERN, this.#errorContextValuePath);
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_PARENT_PATH_PATTERN, utils.getParentPath(this.#errorContextValuePath, this.#contextValueCurrentPath));
                    }
                    if (this.#contextValueCurrentPath) {
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_CURRENT_PATH_PATTERN, this.#contextValueCurrentPath);
                    }
                }
                if (this.#validatorState.mode === sharedConstants.mode.ON_ERROR_THROW) {
                    let error = new ValidationError(fullMessage, this.#errorContextValuePath);
                    Error.captureStackTrace(error, this.#handleError); // exclude this method from stacktrace
                    throw error;
                }
            }
        } finally {
            // should be the last thing we do
            this.#validatorCallbackContext.validatorContextDone(this, success, fullMessage);
        }
        return !!success; // make sure it's a boolean
    }

    #throwArgumentError(message) {
        throw new Error(`ValidatorContext usage error: ${message}`);
    }

}

module.exports = { ValidatorContext };