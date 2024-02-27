import _ from 'lodash';
import { ValidatorInternalState } from './validator-internal-state.js';
import { ValidationError } from './validation-error.js';
import * as sharedConstants from './shared-constants.js';
import { Debug } from './debug.js';
import * as utils from './utils.js';
import { isBoolean, isFunction, isMap, isNil, isNumber, isObject, isSet, isString } from './type-predicates.js';

const INTEGER_STRING_PATTERN = /^-?\d+$/;
const FLOAT_STRING_PATTERN = /^-?\d+(?:\.\d+)?$/;

// a ${NUMBER} not preceded by a \ (so we can escape placeholders) without lookbehind could be written like /([^\\]|^)(\${PATH})/g where group-2 then would be the match
const PLACEHOLDER_PRE_TEST_PATTERN = /(?<!\\)\${.+?}/;
const PLACEHOLDER_PATTERN = /(?<!\\)\${(\d+)}/g;
const PLACEHOLDER_CONTEXT_VALUE_PATTERN = /(?<!\\)\${VALUE}/g;
const PLACEHOLDER_CONTEXT_PATH_PATTERN = /(?<!\\)\${PATH}/g;
const PLACEHOLDER_CONTEXT_PATH_INDEX_PATTERN = /(?<!\\)\${PATH(\d+)}/g;
const PLACEHOLDER_CONTEXT_CURRENT_PATH_PATTERN = /(?<!\\)\${CURRENT_PATH}/g;
const PLACEHOLDER_CONTEXT_PARENT_PATH_PATTERN = /(?<!\\)\${PARENT_PATH}/g;

/**
 * The values to insert at the placeholders in the message string.
 *
 * A single placeholder can just be passed in as a single argument (except for array values, see below).
 * Multiple placeholders must be passed in as an array of the values to insert.
 *
 * To insert an array as a placeholder value it must always be passed in enclosed in an array to be able to
 * distinguish between array literals and multiple placeholder values.
 *
 * Array values and Set's will be inserted as an array-like structure enclosed in square brackets, e.g. ["string", 2].
 *
 * @typedef {string|number|Set<string|number>|(string|number|(string|number)[]|Set<string|number>)[]} MessageArgs
 */

/**
 * Predicate logic for testing the given value/object being validated.
 */
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
     * @package
     */
    _init(validator, validatorState, notContext, validatorCallbackContext) {
        this.#validator = validator;
        this.#validatorState = validatorState;
        this.#notContext = notContext;
        this.#validatorCallbackContext = validatorCallbackContext;
    }

    /**
     * @package
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

    get #errorContextValuePaths() {
        return this.#validatorState.errorContextValuePaths;
    }

    /**
     * Tests if this value is identical to the passed in value using strict comparison (===).
     * @param {*} otherValue - The value to compare this value to.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    identicalTo(otherValue, errorMessage, messageArgs) {
        let success = this.#contextValue === otherValue;
        if (Debug.enabled) {
            this.#printDebug(this.identicalTo.name, success, [otherValue]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is equal to the passed in value.
     *
     * For complex types like objects, arrays, sets, maps etc. a deep comparison is performed.
     * @param {*} otherValue - The value to compare this value to.
     * @param {string} [errorMessage]  - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     * @see https://lodash.com/docs/4.17.15#isEqual
     */
    equalTo(otherValue, errorMessage, messageArgs) {
        let success = _.isEqual(this.#contextValue, otherValue);
        if (Debug.enabled) {
            this.#printDebug(this.equalTo.name, success, [otherValue]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value i `null` or `undefined`.
     * @param {string} [errorMessage]  - The error message to use if the predicate is not fulfilled.
     * @param {string|number|(string|number)[]} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    nil(errorMessage, messageArgs) {
        let success = isNil(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.nil.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is an array.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    anArray(errorMessage, messageArgs) {
        let success = Array.isArray(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.anArray.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a `boolean`.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    aBoolean(errorMessage, messageArgs) {
        let success = isBoolean(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.aBoolean.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a `function`.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    aFunction(errorMessage, messageArgs) {
        let success = isFunction(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.aFunction.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a string representation of a float.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    aFloatString(errorMessage, messageArgs) {
        let success = isString(this.#contextValue) && FLOAT_STRING_PATTERN.test(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.aFloatString.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is an integer.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    anInteger(errorMessage, messageArgs) {
        let success = Number.isInteger(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.anInteger.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a string representation of an integer.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    anIntegerString(errorMessage, messageArgs) {
        let success = isString(this.#contextValue) && INTEGER_STRING_PATTERN.test(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.anIntegerString.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a `number`.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    aNumber(errorMessage, messageArgs) {
        let success = isNumber(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.aNumber.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is an `object`.
     *
     * Arrays are **not** considered objects in this context.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    anObject(errorMessage, messageArgs) {
        let success = isObject(this.#contextValue) && !Array.isArray(this.#contextValue); // use isArray to test for arrays
        if (Debug.enabled) {
            this.#printDebug(this.anObject.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is a `string`.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    aString(errorMessage, messageArgs) {
        let success = isString(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.aString.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the value is considered empty.
     *
     * Objects are considered empty if they have no own enumerable string keyed properties.
     *
     * Array-like values such as `arguments` objects, arrays, buffers, strings are considered empty if they have a `length` of `0`.
     * Similarly, maps and sets are considered empty if they have a `size` of `0`.
     *
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    empty(errorMessage, messageArgs) {
        let success = _.isEmpty(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.empty.name, success);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is less than the passed in number.
     * @param {number} value - The value this value should be less than.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    lessThan(value, errorMessage, messageArgs) {
        if (!isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = isNumber(this.#contextValue) && this.#contextValue < value;
        if (Debug.enabled) {
            this.#printDebug(this.lessThan.name, success, [value]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is less than or equal to the passed in number.
     * @param {number} value - The value this value should be less than or equal to.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    lessThanOrEqualTo(value, errorMessage, messageArgs) {
        if (!isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = isNumber(this.#contextValue) && this.#contextValue <= value;
        if (Debug.enabled) {
            this.#printDebug(this.lessThanOrEqualTo.name, success, [value]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is greater than the passed in number.
     * @param {number} value - The value this value should be greater than.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    greaterThan(value, errorMessage, messageArgs) {
        if (!isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = isNumber(this.#contextValue) && this.#contextValue > value;
        if (Debug.enabled) {
            this.#printDebug(this.greaterThan.name, success, [value]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is greater than or equal to the passed in number.
     * @param {number} value - The value this value should be greater than or equal to.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    greaterThanOrEqualTo(value, errorMessage, messageArgs) {
        if (!isNumber(value)) {
            this.#throwArgumentError(`The argument for "value" must be a number but was: "${value}"`);
        }
        let success = isNumber(this.#contextValue) && this.#contextValue >= value;
        if (Debug.enabled) {
            this.#printDebug(this.greaterThanOrEqualTo.name, success, [value]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is in the range of the passed in start and end values (both inclusive).
     * @param {number} start - The range start (inclusive).
     * @param {number} end - The range end (inclusive).
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    inRange(start, end, errorMessage, messageArgs) {
        if (!isNumber(start) || !isNumber(end)) {
            this.#throwArgumentError(`The arguments for "start" and "end" must both be numbers but was: start="${start}", end="${end}"`);
        }
        let success = isNumber(this.#contextValue) && this.#contextValue >= start && this.#contextValue <= end;
        if (Debug.enabled) {
            this.#printDebug(this.inRange.name, success, [start, end]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value is in the passed in collection of values.
     * @param {*[]|Set<*>|Map<*, *>} values - The array, Set or Map of values to test against.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    in(values, errorMessage, messageArgs) {
        if (!Array.isArray(values) && !isSet(values) && !isMap(values)) {
            this.#throwArgumentError(`The argument for "values" must be an array, Set or Map but was: "${typeof values}"`);
        }
        let success = false;
        if (Array.isArray(values)) {
            for (let possibleValue of values) {
                success = (this.#contextValue === possibleValue);
                if (success) {
                    break;
                }
            }
        } else { // must be a Set or Map
            success = values.has(this.#contextValue);
        }

        if (Debug.enabled) {
            this.#printDebug(this.in.name, success, [values]);
        }

        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value starts with the passed in string.
     * @param {string} startStr - The string this value should start with.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    startWith(startStr, errorMessage, messageArgs) { // method name is correct as we use i with a "does" -> name.does.startWith()
        if (!isString(startStr)) {
            this.#throwArgumentError(`The argument for "startStr" must be a string but was: "${typeof startStr}"`);
        }
        let success = this.#contextValue.startsWith(startStr);

        if (Debug.enabled) {
            this.#printDebug(this.startWith.name, success, [startStr]);
        }

        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value ends with the passed in string.
     * @param {string} endStr - The string this value should end with.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    endWith(endStr, errorMessage, messageArgs) { // method name is correct as we use i with a "does" -> name.does.endWith()
        if (!isString(endStr)) {
            this.#throwArgumentError(`The argument for "endStr" must be a string but was: "${typeof endStr}"`);
        }
        let success = this.#contextValue.endsWith(endStr);

        if (Debug.enabled) {
            this.#printDebug(this.endWith.name, success, [endStr]);
        }

        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if the predicate is successful.
     *
     * @example
     * let test = Validator.create('Validation error:');
     * let name = "John";
     * // user defined predicate
     * test(name).fulfill(name => name.is.aString() && name.value.length > 1, "Name must be a string and must have length > 1");
     * // using the existing validator context.
     * test(name).does.fulfill(name => name.is.aString(), 'Name must be a string');
     *
     * // OBS we can add a general error message which relates to the full predicate test. If so it is important NOT
     * // to pass in an error message to the inner predicates because they would then throw an error or break depending on the mode of the validator
     *
     * @param {function(Validator)|boolean} predicate - A predicate function which returns a boolean or the results of a predicate.
     * Use the passed in validator context to get access to the predicates of this validator.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    fulfill(predicate, errorMessage, messageArgs) {
        if (Debug.enabled) {
            this.#printDebug(`${this.fulfill.name}<start>`, undefined, [], Debug.indent.BEGIN);
        }

        let success = isFunction(predicate) ? predicate(this.#validator) : !!predicate;

        if (Debug.enabled) {
            this.#printDebug(`${this.fulfill.name}<end>`, success, [], Debug.indent.END);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if one of the predicates are successful.
     *
     * @example
     * let test = Validator.create('Validation error:');
     * let name = "John";
     * test(name).fulfillOneOf(name => [
     *     name.value.length > 1,    // user defined predicate
     *     name.does.match(/\W+/)    // using the existing validator context
     * ], "Name must have length > 1 or not include \w characters");
     *
     * // combining multiple tests. We don't even need to pass in an initial value
     * test().fulfillOneOf(() => [
     *     test(name.length).is.aNumber(), // create a new test and include the boolean result
     *     test(name).does.match(/\W+/),   // create a new test and include the boolean result
     *     2 > 1,                    // anything evaluating to a boolean is fine
     *     true
     * ], 'weird validation did not pass');
     *
     * // OBS it is important NOT to pass in an error message to the inner predicates because they would then
     * // throw an error or break depending on the mode of the validator and the remaining predicates would not be tested,
     * // which they should in fulfillOnOf()
     *
     * @param {function(Validator):boolean[]} predicates - A function returning an array of predicate results.
     * Use the passed in validator to add further predicates for the current value.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     * @see fulfill
     * @see fulfillAllOf
     */
    fulfillOneOf(predicates, errorMessage, messageArgs) {
        this.#validatorCallbackContext.enableShortCircuitStickyOn(true);
        if (!isFunction(predicates)) {
            this.#throwArgumentError(`The argument "predicates" must be a function returning an array`);
        }

        let predicateArray = predicates(this.#validator);

        if (!Array.isArray(predicateArray)) {
            this.#throwArgumentError(`The returned value from "predicates" must be an array`);
        }

        if (Debug.enabled) {
            this.#printDebug(`${this.fulfillOneOf.name}<start>`, undefined, [], Debug.indent.BEGIN);
        }

        let success = false;
        for (let predicate of predicateArray) {
            if (isFunction(predicate)) {
                this.#throwArgumentError('a function is not a valid predicate result');
            } else {
                success = !!predicate;
            }

            if (success) {
                break;
            }
        }
        this.#validatorCallbackContext.disableShortCircuitSticky();

        if (Debug.enabled) {
            this.#printDebug(`${this.fulfillOneOf.name}<end>`, success, [], Debug.indent.END);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if all the predicates are successful.
     *
     * @example
     * let test = Validator.create('Validation error:', Validator.mode.ON_ERROR_BREAK);
     * let name = "John";
     * test(name).fulfillAllOf(name => [
     *     name.is.aString(),
     *     name.is.equalTo("John")
     * ], 'Name must be a string and have the value "John"');
     *
     * // combining multiple tests. We don't even need to pass in an initial value.
     * test().fulfillOneOf(() => [
     *     test(name.length).is.aNumber(), // create a new test and include the boolean result
     *     test(name).does.match(/\W+/),   // create a new test and include the boolean result
     *     2 > 1,                    // anything evaluating to a boolean is fine
     *     true
     * ], 'weird validation did not pass');
     *
     * // OBS we can add a general error message which relates to all tests in the array. If so it is important NOT
     * // to pass in an error message to the inner predicates because they would then throw an error or break depending on the mode of the validator
     *
     * @param {function(Validator):boolean[]} predicates a function returning an array of predicate results.
     * Use the passed in validator to add further predicates for the current value.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     * @see fulfill
     * @see fulfillOneOf
     */
    fulfillAllOf(predicates, errorMessage, messageArgs) {
        this.#validatorCallbackContext.enableShortCircuitStickyOn(false);
        if (!isFunction(predicates)) {
            this.#throwArgumentError(`The argument "predicates" must be a function returning an array`);
        }

        let predicateArray = predicates(this.#validator);

        if (!Array.isArray(predicateArray)) {
            this.#throwArgumentError(`The returned value from "predicates" must be an array`);
        }

        if (Debug.enabled) {
            this.#printDebug(`${this.fulfillAllOf.name}<start>`, undefined, [], Debug.indent.BEGIN);
        }

        let success = true;
        for (let predicate of predicateArray) {
            if (isFunction(predicate)) {
                this.#throwArgumentError('a function is not a valid predicate result');
            } else {
                let predicateSuccess = !!predicate;
                if (!predicateSuccess) {
                    success = false;
                }
            }
            // on mode = ON_ERROR_NEXT_PATH we need to let the validator handle it, so it can collect errors for all paths (not required in fulfillOneOf as it only needs to fulfill one predicate)
            if (!success && this.#validatorState.mode !== sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                break;
            }
        }
        this.#validatorCallbackContext.disableShortCircuitSticky();

        if (Debug.enabled) {
            this.#printDebug(`${this.fulfillAllOf.name}<end>`, success, [], Debug.indent.END);
        }

        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * Tests if this value matches the passed in `RegExp`.
     * @param {RegExp} regex - The regular expression to test the value against.
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     * @returns {boolean} The result of the predicate.
     */
    match(regex, errorMessage, messageArgs) {
        if (!(regex instanceof RegExp)) {
            this.#throwArgumentError(`The argument "regex" must be an instance of RegEx but was: "${regex}"`);
        }
        let success = regex.test(this.#contextValue);
        if (Debug.enabled) {
            this.#printDebug(this.match.name, success, [regex]);
        }
        return this.#handleError(success, errorMessage, messageArgs);
    }

    /**
     * @param {boolean} success
     * @param {string} [errorMessage] the error message. If defined and the result is false an error with the message will be thrown
     * @param {MessageArgs} [messageArgs]
     * @return {boolean}
     */
    #handleError(success, errorMessage, messageArgs = []) {
        if (this.#notContext) {
            success = !success;
        }
        if (!success) {
            if (!Array.isArray(messageArgs)) {
                messageArgs = [messageArgs];
            }
            messageArgs = messageArgs.map(messageArgsToString);
        }

        let fullMessage;

        try {
            if (!success && errorMessage !== undefined) {
                fullMessage = this.#validatorState.getFullErrorMessage(errorMessage);

                if (messageArgs.length > 0 || fullMessage.match(PLACEHOLDER_PRE_TEST_PATTERN)) {
                    fullMessage = fullMessage.replace(PLACEHOLDER_PATTERN, (match, group1) => messageArgs[group1]);
                    fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_VALUE_PATTERN, this.#contextValue);
                    if (this.#errorContextValuePaths.length > 0) {
                        let primaryErrorContextValuePath = this.#errorContextValuePaths[0];
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_PATH_PATTERN, primaryErrorContextValuePath);
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_PARENT_PATH_PATTERN, utils.getParentPath(primaryErrorContextValuePath, this.#contextValueCurrentPath));
                        if (this.#errorContextValuePaths.length > 1) { // makes i possible to reference ${PATHx}
                            for (let i = 0; i < this.#errorContextValuePaths.length; i++) {
                                fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_PATH_INDEX_PATTERN, (match, group1) => this.#errorContextValuePaths[group1]);
                            }
                        }
                    }
                    if (this.#contextValueCurrentPath) {
                        fullMessage = fullMessage.replace(PLACEHOLDER_CONTEXT_CURRENT_PATH_PATTERN, this.#contextValueCurrentPath);
                    }
                }
                if (this.#validatorState.mode === sharedConstants.mode.ON_ERROR_THROW) {
                    let error = new ValidationError(fullMessage, this.#errorContextValuePaths.join('|'));
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

    #printDebug(methodName, success, methodArgs = [], indent = Debug.indent.NONE) {
        if (indent === Debug.indent.END) {
            Debug.instance.indent(indent);
        }
        if (this.#notContext) {
            success = !success;
        }
        let iconStr = success === undefined ? '[ ]' : success ? '[V]' : '[-]';
        let pathStr = Debug.instance.pathStr(this.#errorContextValuePaths.join('|'));
        let valueStr = Debug.instance.valueToStr(this.#contextValue);
        let methodArgsStr = Debug.instance.methodArgsToStr(methodArgs);
        let methodPrefix = this.#notContext ? '!' : '';
        let message = `${pathStr}=${valueStr} ${methodPrefix}${methodName} ${methodArgsStr}`;
        Debug.instance.printMessage(iconStr, message);

        if (indent === Debug.indent.BEGIN) {
            Debug.instance.indent(indent);
        }
    }

}

function messageArgsToString(val) {
    if (val instanceof Set) {
        val = Array.from(val);
    }
    if (Array.isArray(val)) {
        val = JSON.stringify(val, null, 1)
            .replaceAll('\n', '')
            .replace('[ ', '[');
    } else {
        val = val + ""; // make sure it is a string
    }
    return val;
}

export { ValidatorContext };
