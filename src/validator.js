import _ from 'lodash';
import { ValidatorPool } from './validator-pool.js';
import { ValidatorContext } from './validator-context.js';
import { ValidationResult } from './validation-result.js';
import { ValidatorInternalState } from "./validator-internal-state.js";
import { ValidationError } from "./validation-error.js";
import * as sharedConstants from "./shared-constants.js";
import { Debug } from "./debug.js";
import * as utils from "./utils.js";
import { isFunction, isNil, isString } from './type-predicates.js';
import { RuleSet } from "./rule-set.js";

const POOL_MAX_SIZE = 10;

const PRIVATE_CONSTRUCTOR_KEY = {};

const MODE_VALUES = new Set(Object.values(sharedConstants.mode));

function fulfilledPredicate() {
    return true;
}

function noopFunction() {
}

/*
* note to self
* When returning something else than "this" to the user the chain is broken for this validator
* and therefore important that we end the context so the validator can be reused, see examples in prop(), value(), transform(), each()
* we need to do it explicitly because there will never be a call to an actual ValidatorContext which is normally responsible
* for calling validatorContextDone() which returns the validator to the pool
* */

/**
 * The Validator class provides actions and predicate verbs for performing validation checks on the given value or object to validate.
 */
class Validator {

    static #contextPool = new ValidatorPool(POOL_MAX_SIZE, (name) => new ValidatorContext(name), 'ContextPool');
    static #validatorPool = new ValidatorPool(POOL_MAX_SIZE, (name) => new Validator(name, PRIVATE_CONSTRUCTOR_KEY), 'ValidatorPool');
    static #validatorStatePool = new ValidatorPool(POOL_MAX_SIZE, (name) => new ValidatorInternalState(name), 'ValidatorStatePool');

    static #shortCircuitFulfilledValidatorContext = new Proxy(new ValidatorContext(), {
        get(/*target, prop, receiver*/) {
            return fulfilledPredicate; // make all methods of ValidatorContext() return true
        }
    });

    static #noopValidationResult = new Proxy(new ValidationResult(), {
        get(/*target, prop, receiver*/) {
            return noopFunction;
        }
    });

    /**
     * The possible Validator modes.
     *
     * - `ON_ERROR_THROW`: Throws a {@link ValidationError} if a test fails.
     * - `ON_ERROR_BREAK`: Abort the remaining tests if a test fails.
     * - `ON_ERROR_NEXT_PATH`: Continue to next path if the test for the current path fails.
     *
     * @type {Readonly<{ON_ERROR_NEXT_PATH: string, ON_ERROR_THROW: string, ON_ERROR_BREAK: string}>}
     */
    static mode = sharedConstants.mode;

    #name;
    /**
     * @type {ValidatorInternalState}
     */
    #validatorState;
    #validatorSharedState;
    #rootValidatorContext;
    #contextShortCircuit = { fulfilled: false, sticky: [] };
    #callbackContext;

    constructor(name, privateConstructorKey) {
        if (privateConstructorKey !== PRIVATE_CONSTRUCTOR_KEY) {
            throw new Error('Use Validator.create*() to create a new validation context');
        }
        this.#name = name;

        this.#callbackContext = {
            validatorContextDone: this.#validatorContextDone,
            enableShortCircuitStickyOn: this.#enableShortCircuitStickyOn,
            disableShortCircuitSticky: this.#disableShortCircuitSticky
        };
    }

    /**
     * @param {ValidatorInternalState} validatorState
     * @param {object} validatorSharedState
     * @param {boolean} shortCircuit
     */
    #init(validatorState, validatorSharedState, shortCircuit = false) {
        this.#validatorState = validatorState;
        if (validatorSharedState) {
            this.#validatorSharedState = validatorSharedState;
        } else {
            this.#validatorSharedState = {
                failedPaths: []
            };
        }
        if (shortCircuit) {
            this.#contextShortCircuit.fulfilled = true;
        }
    }

    #reset(validatorContext) {
        if (!validatorContext) {
            throw new Error('Internal Validator error, a validatorContext must be passed to #reset()');
        }

        this.#contextShortCircuit.fulfilled = false;

        /* only the root validatorContext can reset the entire validator
         * otherwise nested methods like fulfillOneOf, fulfillAllOf cannot
         * have multiple conditions when using the passed in Validator
         * because the first condition would then reset the Validator when finishing
         */
        if (this.#rootValidatorContext === validatorContext) {
            Validator.#validatorStatePool.return(this.#validatorState);
            this.#validatorState = undefined;
            this.#validatorSharedState = undefined;
            this.#rootValidatorContext = undefined;
            if (this.#contextShortCircuit.sticky.length > 0) {
                throw new Error('Internal Validator error, #contextShortCircuit.sticky should have been disabled');
            }
            Validator.#validatorPool.return(this);
        }

        if (validatorContext !== Validator.#shortCircuitFulfilledValidatorContext) {
            validatorContext._reset();
            Validator.#contextPool.return(validatorContext);
        }
    }

    /**
     * @returns {string}
     */
    get #contextValue() {
        return this.#validatorState.contextValue;
    }

    /**
     * @returns {string}
     */
    get #contextValuePath() {
        return this.#validatorState.contextValuePath;
    }

    /**
     * @returns {string}
     */
    get #contextValueCurrentPath() {
        return this.#validatorState.contextValueCurrentPath;
    }

    /**
     * @returns {string[]}
     */
    get #errorContextValuePaths() {
        return this.#validatorState.errorContextValuePaths;
    }

    get #mode() {
        return this.#validatorState.mode;
    }

    /**
     * @param {boolean} notContext set to `true` if this is a notContext otherwise <code>false`
     * @param {boolean} [resetShortCircuitContext=true] should shortCircuit contexts be reset automatically?
     * @returns {*}
     */
    #getValidatorContext(notContext, resetShortCircuitContext = true) {
        let validatorContext;
        let shortCircuit = this.#shortCircuit();
        if (shortCircuit) {
            validatorContext = Validator.#shortCircuitFulfilledValidatorContext;
        } else {
            validatorContext = Validator.#contextPool.get();
            validatorContext._init(this, this.#validatorState, notContext, this.#callbackContext);
        }
        // we need this to know when we can return the validator to the pool, see #reset
        if (!this.#rootValidatorContext) {
            this.#rootValidatorContext = validatorContext;
        }
        if (shortCircuit && resetShortCircuitContext) {
            // Reset immediately. We still need to pass-in the rootContext though, for reset to work correctly.
            this.#reset(validatorContext);
        }
        return validatorContext;
    }

    #istShortCircuitValidatorContext(validatorContext) {
        return validatorContext === Validator.#shortCircuitFulfilledValidatorContext;
    }

    /**
     * @returns {boolean}
     */
    #shortCircuit() {
        let shortCircuitDueToAction = false;
        if (this.#validatorSharedState.failedPaths.length > 0) {
            if (this.#mode === sharedConstants.mode.ON_ERROR_BREAK) {
                shortCircuitDueToAction = true;
            } else if (this.#mode === sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                for (let failedPath of this.#validatorSharedState.failedPaths) {
                    for (let errorContextValuePath of this.#errorContextValuePaths) {
                        if (errorContextValuePath.startsWith(failedPath)) {
                            shortCircuitDueToAction = true;
                            break;
                        }
                    }
                }
            }
        }

        let stickyFulfilled = (this.#contextShortCircuit.sticky.length > 0 && this.#contextShortCircuit.sticky[this.#contextShortCircuit.sticky.length - 1].fulfilled);

        return this.#contextShortCircuit.fulfilled || stickyFulfilled || shortCircuitDueToAction;
    }

    #noopContext() {
        // get and end it right away, we still need to do this for reset() to work correctly
        let validatorContext = this.#getValidatorContext(false, false); // validatorContextDone will reset the context
        this.#validatorContextDone(validatorContext);
    }

    #validatorContextDone = (validatorContext, success = undefined, errorMessage) => {
        if (success !== undefined) { // important that we allow undefined for e.g. prop() which just uses this to reset the context
            if (!success && !this.#shortCircuit() && errorMessage) {
                for (let errorContextValuePath of this.#errorContextValuePaths) {
                    this.#validatorState.validationResult._addFailedPath(errorContextValuePath, errorMessage);
                    this.#validatorSharedState.failedPaths.push(errorContextValuePath);
                }
            }
            if (this.#contextShortCircuit.sticky.length > 0) {
                let stickyContext = this.#contextShortCircuit.sticky[this.#contextShortCircuit.sticky.length - 1];
                if (!stickyContext.fulfilled && stickyContext.fulfillValue === success) {
                    stickyContext.fulfilled = true;
                }
            }
        }
        this.#reset(validatorContext);
    };

    #enableShortCircuitStickyOn = (successValue) => {
        /*
        * We allow re-entrant shortCircuitSticky calls e.g. ...
        * test(name).fulfillAllOf((name) => [
        *     name.is.aString(),
        *     name.fulfillAllOf(name => [
        *        ...,
        *        ...
        *     ])
        * ]);
        * ... where each creates their own context on the stack.
        * */

        this.#contextShortCircuit.sticky.push({
            fulfillValue: successValue,
            fulfilled: false
        });
    };

    #disableShortCircuitSticky = () => {
        this.#contextShortCircuit.sticky.pop();
    };

    /**
     * @param {ValidatorContext} currentValidatorContext
     * @param {*} contextValue the value for this validator
     * @param {string} [contextValuePath] the contextValuePath for this validator if <code>undefined` the value from the parent will be used
     * @param {string} [contextValueCurrentPath] the contextValueCurrentPath for this validator if <code>undefined` the value from the parent will be used
     * @param {string[]} [errorContextPaths] add one or more additional context paths to the errorContextValuePaths generated by this validator and sub validators
     * @returns {Validator}
     */
    #createChildValidator(currentValidatorContext, contextValue, contextValuePath, contextValueCurrentPath, errorContextPaths) {
        let validatorState = this.#validatorState.cloneWith(Validator.#validatorStatePool.get(), contextValue, contextValuePath, contextValueCurrentPath, errorContextPaths);
        let validator = Validator.#validatorPool.get();
        let shortCircuit = this.#istShortCircuitValidatorContext(currentValidatorContext) || this.#shortCircuit();
        // if the parent is short-circuited, make sure the child is as well this goes for e.g. prop()
        validator.#init(validatorState, this.#validatorSharedState, shortCircuit);
        return validator;
    }

    /**
     * Returns a `ValidatorContext` for the current value.
     * @returns {ValidatorContext} - The predicate context for this verb.
     * @see does
     */
    get is() {
        return this.#getValidatorContext(false);
    }

    /**
     * Returns a `ValidatorContext` for the current value.
     * @returns {ValidatorContext} - The predicate context for this verb.
     * @see is
     */
    get does() {
        return this.#getValidatorContext(false);
    }

    /**
     * Returns a *not* `ValidatorContext` for the current value.
     * @returns {ValidatorContext} - The *not* predicate context for this verb.
     * @see doesNot
     */
    get isNot() {
        return this.#getValidatorContext(true);
    }

    /**
     * Returns a *not* `ValidatorContext` for the current value.
     * @returns {ValidatorContext} - The *not* predicate context for this verb.
     * @see isNot
     */
    get doesNot() {
        return this.#getValidatorContext(true);
    }

    /**
     * Tests the following predicate *only* if this value is defined. (not <code>null` and not <code>undefined`).
     *
     * Descendant predicates added with {@link #each}, {@link ValidatorContext#fulfill}, {@link ValidatorContext#fulfillAllOf},
     * {@link ValidatorContext#fulfillOneOf} will as well only be tested if this value i defined.
     *
     * @example
     * let test = Validator.create();
     * let person = null;
     * // the below tests will only be performed if person is defined
     * test(person).optional.fulfillAllOf(person => [
     *      person.is.anObject('person must be an object'),
     *      person.prop("name").fulfillAllOf(name => [
     *          name.is.aString('"${PATH}" must be a string'),
     *          name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     *      ]),
     *      // will only be tested if person is defined and <code>person.age` is defined
     *      test(person).optional.prop("age").optional.is.aNumber('"${PATH}" must be a number')
     * ]);
     *
     * @returns {Validator} This instance set to optional mode.
     */
    get optional() {
        if (isNil(this.#contextValue)) {
            this.#contextShortCircuit.fulfilled = true;
            if (Debug.enabled) {
                this.#printDebug('{?}', 'optional', 'bypassed branch because of nil value');
            }
        }
        return this;
    }

    /**
     * Evaluates the following tests *only* if the passed in predicate is fulfilled.
     *
     * If the predicate is a function, the function is passed an instance of a `Validator` with the current value.
     *
     * @example
     * let test = Validator.create();
     * let person = { name: "John", age: 54 };
     * test(person).fulfillAllOf(person => [
     *      person.is.anObject('person must be an object'),
     *      person.conditionally(person => person.prop('name').is.equalTo('Eric')).fulfill(
     *          person => person.prop('age').is.greaterThan(50, "Age must be greater than 50 for persons named Eric")
     *      )
     * ]);
     *
     * @param {(function(Validator):boolean)|boolean} predicate - The predicate which must be fulfilled for the following tests to be carried out.
     * @returns {Validator} A validator which tests only will be performed if this predicate is fulfilled.
     */
    conditionally(predicate) {
        let fulfilled;
        if (isFunction(predicate)) {
            // we need a new validator which does not add error messages etc. to the overall context, we only need of for the predicate result
            let validator = Validator.#instance(Validator.mode.ON_ERROR_BREAK, this.#contextValue, this.#contextValuePath, this.#contextValueCurrentPath,
                "", "", Validator.#noopValidationResult);
            fulfilled = !!predicate(validator);
        } else {
            fulfilled = !!predicate;
        }
        if (!fulfilled) {
            this.#contextShortCircuit.fulfilled = true;
            if (Debug.enabled) {
                this.#printDebug('{&}', this.conditionally.name, 'bypassed branch because of failed condition');
            }
        }
        return this;
    }

    /**
     * Tests the `predicate` against each element of the iterable.
     *
     * If the `predicate` is a function, the function is passed an instance of a `Validator` with the current value.
     *
     * @example
     * let test = Validator.create();
     * let numbers = [1, 2, "three", 4];
     * test(numbers).each(number => number.is.aNumber(), 'The element must be a number but was "${VALUE}"');
     * // we can get the actual value if we need it
     * test(numbers).each(number => number.value  !== 10 && number.value > 7,
     *      "The number cannot 10 and must be greater than 7");
     * // for a more fine-grained error message add the error message to the individual test.
     * test(numbers).each(number => number.fulfillAllOf(number => [
     *      number.is.aNumber('The element must be a number but was "${VALUE}"'),
     *      number.is.inRange(1, 10, 'The element must be in the range [1, 10] was "${VALUE}"'),
     * ]));
     *
     * @param {string} [errorMessage] - The error message to use if the predicate is not fulfilled.
     * @param {MessageArgs} [messageArgs] - The values for placeholders in the errorMessage.
     *  @param {function(Validator)|boolean} predicate - A predicate function which returns a boolean or a boolean expression. Use the passed in validator context to get access to the predicates of this validator.
     * @returns {boolean} <code>true` if all elements passed the predicate test otherwise <code>false`.
     */
    each(predicate, errorMessage, messageArgs) {
        // we should always activate the validatorContext and end it with validatorContextDone
        // to make sure reset() works correctly and the context is returned to the contextPool
        let validatorContext = this.#getValidatorContext(false);
        if (this.#istShortCircuitValidatorContext(validatorContext)) { // getValidatorContext() resets shortCircuitValidatorContexts for us, so it is ok to just return right away when short-circuit
            return true; // just fulfill right away
        }

        if (isNil(this.#contextValue) || !(Symbol.iterator in this.#contextValue)) { // nothing to iterate over, if nothing to test, we cannot know the result, so return false
            Validator.#throwArgumentError('the value must be iterable to use each()');
        }

        if (Debug.enabled) {
            this.#printDebug('{@}', `${this.each.name}<start>`, '', Debug.indent.BEGIN);
        }

        let success = true;
        try {
            let i = 0;
            let isArray = Array.isArray(this.#contextValue);

            for (let element of this.#contextValue) {
                let indexPath;
                if (isArray) {
                    indexPath = `[${i}]`;
                } else {
                    indexPath = `[${element}]`;
                }
                let validator = this.#createChildValidator(validatorContext, element, `${this.#contextValuePath}${indexPath}`, indexPath);
                let predicateSuccess = validator.does.fulfill(predicate, errorMessage, messageArgs);
                if (!predicateSuccess) {
                    success = false;
                }
                // on mode = ON_ERROR_NEXT_PATH we need to let the validator handle it, so it can collect errors for all paths
                if (!success && this.#validatorState.mode !== sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                    break;
                }
                i++;
            }
        } finally {
            if (Debug.enabled) {
                this.#printDebug('{@}', `${this.each.name}<end>`, '', Debug.indent.END);
            }
            this.#validatorContextDone(validatorContext, success);
        }
        return success;
    }

    /**
     * Creates a new `Validator` for the specified property path.
     *
     * @example
     * let test = Validator.create();
     * let test = Validator.create("Person validation error:");
     * let person = { name: "John" };
     * test(person).fulfillAllOf(person => [
     *      person.is.anObject(),
     *      person.prop('name').fulfillAllOf(name => [
     *          name.is.aString(),
     *          name.isNot.empty()
     *      ])
     * ], 'person must be an object and must have the property "name" which cannot be empty');
     * @param {string} path - The path of the property to make a validator for.
     * @returns {Validator} - A `Validator` with value of the property path.
     */
    prop(path) {
        if (!isString(path)) {
            throw new Error('"path" for prop() must be a string');
        }
        let validatorContext = this.#getValidatorContext(false, false);

        let childValue;
        let fullPropPath = utils.joinPropPaths(this.#contextValuePath, path);
        if (!this.#istShortCircuitValidatorContext(validatorContext)) {
            if (!isNil(this.#contextValue)) {
                childValue = this.#contextValue[path];
            }
            if (childValue === undefined) { // lodash get() is a little slow, so only use it if needed.
                // If the parent is optional and nil, _.get() will return undefined, which is fine because createChildValidator sets optional() if parent i optional
                childValue = _.get(this.#contextValue, path);
            }

            if (Debug.enabled) {
                this.#printDebug('{.}', `${this.prop.name}["${path}"]`, `${path}=${Debug.instance.pathStr(childValue)}`);
            }
        }

        let validator = this.#createChildValidator(validatorContext, childValue, fullPropPath, path);
        // important to call this to make sure reset() is called and the context is returned to the contextPool, because we are leaving this context and enter a child validator
        // IMPORTANT that we pass undefined as success, so we don't modify short circuit state etc. as getting a prop is NOT a predicate
        this.#validatorContextDone(validatorContext, undefined);
        return validator;
    }

    /**
     * Returns the value being tested by this validator.
     *
     * This makes it possible to get access to the actual value being tested, so it can be used
     * in tests which is easier carried out using regular programming logic.
     *
     * @example
     * let test = Validator.create();
     * let oddNumbers = [1, 3, 5];
     * test(oddNumbers).fulfillAllOf(oddNumbers => [
     *     oddNumbers.is.anArray('oddNumbers must be an array'),
     *     oddNumbers.each(number => number.fulfillAllOf(number => [
     *          number.is.aNumber('${PATH} must be a number'),
     *          number.fulfill(number => number.value % 2 === 1, '${PATH} must be odd') // get the actual value and use it for generate a result
     *     ])),
     * ]);
     *
     * @returns {*} The value this validator is testing.
     */
    get value() {
        let value = this.#contextValue; // get the value before resetting
        this.#noopContext();
        return value;
    }

    /**
     * Returns the full path of the value being tested.
     *
     * @returns {string} The full path of the value being tested.
     */
    get contextValuePath() {
        return this.#contextValuePath;
    }

    /**
     * Transforms the current value and returns a new `Validator` with the transformed value.
     * @example
     * let test = Validator.create();
     * let name = "John";
     * test(name).fulfillAllOf(name => [
     *      name.is.aString(),
     *      name.transform(name => name.trim()).isNot.empty() // OBS the passed in value is the actual value and not a Validator instance
     * ], 'Name must be a string and cannot be empty');
     *
     * @param {function(*):Validator} transformer - A function for transforming the current value into a new value which should be tested,
     * @returns {Validator} A new validator for the transformed value.
     */
    transform(transformer) {
        if (!isFunction(transformer)) {
            Validator.#throwArgumentError('The argument passed to transform must be a function');
        }

        let validatorContext = this.#getValidatorContext(false, false);
        let transformedValue;
        if (!this.#istShortCircuitValidatorContext(validatorContext)) {
            // we expect that the transformation is used to just transform the current value, so even though it is possible
            // to return everything, transform should only be used to create transformation of what was at the given path
            transformedValue = transformer(this.#contextValue);

            if (Debug.enabled) {
                this.#printDebug('{>}', this.transform.name, `${Debug.instance.valueToStr(this.#contextValue)} -> ${Debug.instance.valueToStr(transformedValue)}`);
            }
        }

        // on short circuit we just pass in an undefined value
        let validator = this.#createChildValidator(validatorContext, transformedValue);
        // important to call this to make sure reset() is called and the context is returned to the contextPool, because we are leaving this context and enter a child validator
        // IMPORTANT that we pass undefined as success, so we don't modify short circuit state etc. as getting a prop is NOT a predicate
        this.#validatorContextDone(validatorContext, undefined);
        return validator;
    }

    /**
     * Modifies the errorContextPath.
     *
     * Sometimes it is not possible, or does not make sense, to validate a property within
     * the scope of the "correct/current" property path. Using this method, the error context path
     * used for mapping paths to errors can be modified for the current validator and child-validators
     * by adding a custom path which will be added to the error prefix path (if set).
     * The path can be whatever makes sense and multiple paths can be set as well making it possible to fail multiple
     * paths if the result of this validator context fails.
     *
     * The full paths can be referenced in the error message with ${PATHx}.
     *
     * @example
     * let test = Validator.create();
     * let person = { email: '', username: 'john' };
     * test(person).errorContext('email', 'username').fulfillOneOf(person => [
     *      person.prop('email').isNot.empty(),
     *      person.prop('username').isNot.empty()
     * ], '"${PATH0}" or "${PATH1}" must be filled out');
     *
     * // the result will have mapped errors to ['email' => '"email" or "username" must be filled out'] and ['username' => '"email" or "username" must be filled out']
     * instead of ['' => '"email" or "username" must be filled out']
     *
     * @param {...string} errorContextPath - The path/paths to postFix the errors from this validation branch with.
     * @returns {Validator} A new validator with the modified error context.
     */
    errorContext(...errorContextPath) {
        for (let path of errorContextPath) {
            if (!isString(path)) {
                Validator.#throwArgumentError('errorContextPath must be string');
            }
        }

        let validatorContext = this.#getValidatorContext(false, false); // context will be reset when we call validatorContextDone

        let validator = this.#createChildValidator(validatorContext, this.#contextValue, this.#contextValuePath, this.#contextValueCurrentPath, errorContextPath);
        // important to call this to make sure reset() is called and the context is returned to the contextPool, because we are leaving this context and enter a child validator
        // IMPORTANT that we pass undefined as success, so we don't modify short circuit state etc. as changing the errorContext is NOT a predicate
        this.#validatorContextDone(validatorContext, undefined);
        return validator;

    }

    /**
     * Alias for [does.fulfill]{@link #ValidatorContext#fulfill}.
     * @param {function(Validator)|boolean} predicate
     * @param {string} [errorMessage]
     * @param {MessageArgs} [messageArgs]
     * @returns {boolean}
     */
    fulfill(predicate, errorMessage, messageArgs) {
        return this.does.fulfill(predicate, errorMessage, messageArgs);
    }

    /**
     * Alias for [does.fulfillOneOf]{@link ValidatorContext#fulfillOneOf}.
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates
     * @param {string} [errorMessage]
     * @param {MessageArgs} [messageArgs]
     * @returns {boolean}
     */
    fulfillOneOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillOneOf(predicates, errorMessage, messageArgs);
    }

    /**
     * Alias for [does.fulfillAllOf]{@link ValidatorContext#fulfillAllOf}.
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates
     * @param {string} [errorMessage]
     * @param {MessageArgs} [messageArgs]
     * @returns {boolean}
     */
    fulfillAllOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillAllOf(predicates, errorMessage, messageArgs);
    }

    #printDebug(icon, methodName, message, indent = Debug.indent.NONE) {
        if (indent === Debug.indent.END) {
            Debug.instance.indent(indent);
        }

        let pathStr = Debug.instance.pathStr(this.#validatorState.errorContextValuePaths.join('|'));
        let messageOut = `${pathStr} ${methodName} ${message}`;
        Debug.instance.printMessage(icon, messageOut);

        if (indent === Debug.indent.BEGIN) {
            Debug.instance.indent(indent);
        }
    }

    /**
     * @param {string} mode
     * @param {string} contextValue
     * @param {string} contextValuePath
     * @param {string} contextValueCurrentPath
     * @param {string} errorPrefix
     * @param {string} errorBasePath
     * @param {ValidationResult} validationResult
     * @param {object} [validatorSharedState]
     * @returns {Validator}
     */
    static #instance(mode, contextValue, contextValuePath, contextValueCurrentPath, errorPrefix,
                     errorBasePath, validationResult, validatorSharedState) {
        let validator = Validator.#validatorPool.get();
        let validatorState = Validator.#validatorStatePool.get();
        validatorState._init(mode, contextValue, contextValuePath,
            contextValueCurrentPath, errorPrefix, errorBasePath, undefined, validationResult);
        validator.#init(validatorState, validatorSharedState);
        return validator;
    }

    /**
     * Creates a new validator. The returned "test" function gives access to the verb context which returns the
     * predicate context used for performing the actual test.
     *
     * If an error message is passed to a test predicate it adds it to the validation result if the predicate is not fulfilled (or throws an error in ON_ERROR_THROW mode).
     * Every predicate returns a boolean with the result of the test.
     *
     * Error message string can use placeholders which will be substituted when the error is added to the validation result or thrown.
     *
     * @example
     * let test = Validator.create('Validation error:', Validator.mode.ON_ERROR_BREAK);
     * let name = "John";
     * let age = 54;
     * let person = { name: "John", age: 43 };
     * test(name).isNot.nil('Name cannot be null or undefined');
     * test(name).is.aString('Name must be a string');
     * test(name).fulfillAllOf(name => [
     *      name.value.length > 1,
     *      name.does.match(/\w+/)
     * ], "Name must have length > 1 and only contain letters");
     *
     * // when testing individual values (or objects), an errorPathPrefix can be passed in a second argument to the test-function.
     * // the errorPathPrefix will be used as a prefix for the path in the validation result and for ${PATH} placeholders (see below) in error messages.
     * // This makes it possible to collect errors from multiple values without having them in an object and still be able to tell them appart.
     *
     * test(name, 'name').is.aString('Name must be a string');
     * test(age, 'age').is.anInteger('Age must be an integer');
     *
     * console.log(test.result.getError('name'));
     * console.log(test.result.getError('age'));
     *
     * // validate properties of an object
     * test(person).prop("age").is.aNumber("${PATH} must be a string");
     * test(person).fulfillAllOf(person => [
     *      person.is.anObject('person must be an object'),
     *      person.prop("name").fulfillAllOf(name => [
     *          name.is.aString('"${PATH}" must be a string'),
     *          name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     *      ]),
     *      person.prop("age").optional.is.aNumber('"${PATH}" must be a number')
     * ]);
     *
     * // use placeholders in the error message
     * test(name).is.aString('The name: "${0}" is not of type string', name);
     * test(name).is.equalTo('Eric', 'The name: "${0} is not equal to ${1}"', [name, 'Eric']);
     * // the value validated can be referenced directly
     * test(name).is.aString('The name: "${VALUE}" is not of type string');
     * // the path validated can be referenced directly
     * test(person).prop("name").is.aString('The property "${PATH}": "${VALUE}" is not of type string');
     * // the current path and parent path for nested properties can be referenced as well
     * test(person).prop("name").prop("length").is.equalTo(1, 'The property "${CURRENT_PATH}": "${VALUE}" of ${PARENT_PATH} must be 1');
     *
     * // inspect the collected errors
     * let rootError = test.result.getError()
     * let nameError = test.result.getError('name')
     * let isValid = test.result.isValid() // was all test valid. This does purely rely on if all tests passed and not if an error message was supplied or not
     * // see the ValidationResult documentation for all possibilities
     *
     * @param {string} errorPrefix - A prefix to prepend to every error created by this validator.
     * @param {'onErrorThrow'|'onErrorBreak'|'onErrorNextPath'} mode - The [mode]{@link Validator.mode} for this validator.
     * @returns {function(value:*, errorBasePath?:string):Validator} The test function to use for validation.
     * @see ValidationResult
     * @see createOnErrorThrowValidator
     * @see createOnErrorBreakValidator
     * @see createOnErrorNextPathValidator
     */
    static create(errorPrefix = '', mode = Validator.mode.ON_ERROR_THROW) {
        return Validator.#testFunction(errorPrefix, mode);
    }

    /**
     * Creates a new validator which throws an {@link ValidationError} if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every error thrown by this validator.
     * @returns {function(value:*, errorBasePath?:string):Validator} The test function to use for validation.
     * @see create
     * @see mode
     */
    static createOnErrorThrowValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_THROW);
    }

    /**
     * Creates a new validator which aborts the remaining tests if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every error created by this validator.
     * @returns {function(value:*, errorBasePath?:string):Validator} The test function to use for validation.
     * @see create
     * @see mode
     */
    static createOnErrorBreakValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_BREAK);
    }

    /**
     * Creates a new validator which continuous to test the next path if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every created by this validator.
     * @returns {function(value:*, errorBasePath?:string):Validator} The test function to use for validation.
     * @see create
     * @see mode
     */
    static createOnErrorNextPathValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_NEXT_PATH);
    }

    /**
     * Creates a new `RuleSet` for reusing a set of validation tests.
     *
     * @example
     * let ruleSet = Validator.createRuleSet('Validation error:', Validator.mode.ON_ERROR_NEXT_PATH);
     *
     * ruleSet.addRule('', person => person.is.anObject('a person must be an object'); // '' references the object itself
     * ruleSet.addRule('name', (name) => name.fulfillAllOf(name => [
     *     name.is.aString('"${PATH}" must be a string'),
     *     name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     * ]);
     * ruleSet.addRule('age', age => age.optional.is.aNumber('"${PATH}" must be a number'));
     *
     * let person = { name: "John", age: 43 };
     *
     * // do a quick test if all rules pass,
     * console.log(ruleSet.isValid(person));
     *
     * // or get detailed information,
     * let validationResult = ruleSet.validate(person);
     * console.log(validationResult.isValid());
     * console.log(validationResult.getAllErrors());
     * console.log(validationResult.getErrors('name'));
     *
     * // the rules can also be tested on individual values
     * let name = 'john';
     * console.log(ruleSet.isValidValue('john', 'name'));
     *
     * @param {string} errorPrefix - A prefix to prepend to every error created by this rule-set.
     * @param {string} mode - The [mode]{@link Validator.mode} for this rule-set.
     * @returns {RuleSet} A new rule-set.
     * @see RuleSet
     * @see ValidationResult
     * @see createOnErrorThrowRuleSet
     * @see createOnErrorBreakRuleSet
     * @see createOnErrorNextPathRuleSet
     */
    static createRuleSet(errorPrefix = '', mode = Validator.mode.ON_ERROR_THROW) {
        return new RuleSet(errorPrefix, mode, Validator.create);
    }

    /**
     * Creates a new `RuleSet` which throws an {@link ValidationError} if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every error thrown by this rule-set.
     * @returns {RuleSet}  A new rule-set.
     * @see createRuleSet
     * @see mode
     */
    static createOnErrorThrowRuleSet(errorPrefix = '') {
        return Validator.createRuleSet(errorPrefix, Validator.mode.ON_ERROR_THROW);
    }

    /**
     * Creates a new `RuleSet` which aborts the remaining tests if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every error created by this rule-set.
     * @returns {RuleSet}  A new rule-set.
     * @see createRuleSet
     * @see mode
     */
    static createOnErrorBreakRuleSet(errorPrefix = '') {
        return Validator.createRuleSet(errorPrefix, Validator.mode.ON_ERROR_BREAK);
    }

    /**
     * Creates a new `RuleSet` which continuous to test the next path if a test fails.
     * @param {string} errorPrefix - A prefix to prepend to every error created by this rule-set.
     * @returns {RuleSet} A new rule-set.
     * @see createRuleSet
     * @see mode
     */
    static createOnErrorNextPathRuleSet(errorPrefix = '') {
        return Validator.createRuleSet(errorPrefix, Validator.mode.ON_ERROR_NEXT_PATH);
    }

    /**
     * Returns the validation result of the test function.
     *
     * The validation result can also be accessed directly using <code>testFunction.result`.
     * @param {function(value:*, errorBasePath?:string):Validator} testFunction - The test-function which performed the tests.
     * @returns {ValidationResult} The validation result associated with the test-function.
     * @see create
     * @see createOnErrorThrowValidator
     * @see createOnErrorBreakValidator
     * @see createOnErrorNextPathValidator
     */
    static validationResult(testFunction) {
        return testFunction['result'];
    }

    /**
     * Enables debugging information printed to the console.
     * @param {boolean} enable - Enables or disables the debug mode.
     */
    static debug(enable = true) {
        Debug.enable(enable);
    }

    /**
     * @param {string} errorPrefix
     * @param {string} mode
     * @returns {function(value:*, errorBasePath?:string):Validator}
     */
    static #testFunction(errorPrefix, mode) {
        if (!MODE_VALUES.has(mode)) {
            Validator.#throwArgumentError(`"mode" must be one of [${Array.from(MODE_VALUES).join(', ')}]`);
        }

        let validationResult = new ValidationResult();

        /**
         * @param {*} value the value to test
         * @param {string=""} errorBasePath the base path for this error
         * @returns {Validator}
         */
        let test = (value, errorBasePath = "") => {
            return Validator.#instance(mode, value, "", "", errorPrefix, errorBasePath, validationResult);
        };

        test.result = validationResult;
        return test;
    }

    static #throwArgumentError(message) {
        throw new Error(`Validator usage error: ${message}`);
    }

}

export { Validator };