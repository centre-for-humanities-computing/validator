const _ = require('lodash');
const { ValidatorPool } = require('./validator-pool');
const { ValidatorContext } = require('./validator-context');
const { ValidationResult } = require('./validation-result');
const { ValidatorInternalState } = require('./validator-internal-state');
const { ValidationError } = require('./validation-error');
const sharedConstants = require('./shared-constants');
const utils = require('./utils');

const POOL_MAX_SIZE = 10;

const PRIVATE_CONSTRUCTOR_KEY = {};

const MODE_VALUES = new Set(Object.values(sharedConstants.mode));

/*
* note to self
* When returning something else than "this" to the user the chain is broken for this validator
* and therefore important that we end the context so the validator can be reused, see examples in prop(), value(), transform(), each()
* we need to do it explicitly because there will never be a call to an actual ValidatorContext which is normally responsible
* for calling validatorContextDone() which returns the validator to the pool
* */

class Validator {

    static #contextPool = new ValidatorPool(POOL_MAX_SIZE,(name) => new ValidatorContext(name), 'ContextPool');
    static #validatorPool = new ValidatorPool(POOL_MAX_SIZE, (name) => new Validator(name, PRIVATE_CONSTRUCTOR_KEY), 'ValidatorPool');
    static #validatorStatePool = new ValidatorPool(POOL_MAX_SIZE, (name) => new ValidatorInternalState(), 'ValidatorStatePool');
    static #shortCircuitFulfilledValidatorContext = new Proxy(new ValidatorContext(), {
        fulfilledPredicate() {
            return true;
        },
        get: function(target, prop, receiver) {
            return this.fulfilledPredicate; // make all methods of ValidatorContext() return true
        }
    });
    static #noopValidationResult = new Proxy(new ValidationResult(), {
        noopFunc: function() {

        },
        get: function(target, prop, receiver) {
            return this.noopFunc;
        }
    })

    /**
     * ON_ERROR_THROW:      Throws a {@link ValidationError} if a test fails
     *
     * ON_ERROR_BREAK:      Abort the remaining tests if a test fails
     *
     * ON_ERROR_NEXT_PATH:  Continue to next path if the test for current path fails
     *
     * @type {Readonly<{ON_ERROR_NEXT_PATH: string, ON_ERROR_THROW: string, ON_ERROR_BREAK: string}>}
     */
    static mode = sharedConstants.mode;

    #name;
    /**
     * @type ValidatorInternalState
     */
    #validatorState;
    #validatorSharedState;
    #rootValidatorContext;
    #contextShortCircuit = { fulfilled: false, sticky: undefined };
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
            throw new Error('Internal Validator error, validatorContext must be passed to #reset()');
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
            if (this.#contextShortCircuit.sticky) {
                throw new Error('Internal Validator error, #contextShortCircuit.sticky should have been disabled')
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
     * @returns {string}
     */
    get #errorContextValuePath() {
        return this.#validatorState.errorContextValuePath;
    }

    get #mode() {
        return this.#validatorState.mode;
    }

    #getValidatorContext(notContext) {
        let validatorContext;
        if (this.#shortCircuit()) {
            validatorContext = Validator.#shortCircuitFulfilledValidatorContext;
        } else {
            validatorContext = Validator.#contextPool.get();
            validatorContext._init(this, this.#validatorState, notContext, this.#callbackContext);
        }
        // we need this to know when we can return the validator to the pool, see #reset
        if (!this.#rootValidatorContext) {
            this.#rootValidatorContext = validatorContext;
        }
        if (this.#shortCircuit()) {
            // reset immediately, we still need to set the rootContext first though for reset to work correctly
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
                    if (this.#errorContextValuePath.startsWith(failedPath)) {
                        shortCircuitDueToAction = true;
                        break;
                    }
                }
            }
        }

        return this.#contextShortCircuit.fulfilled || this.#contextShortCircuit.sticky?.[this.#contextShortCircuit.sticky.length - 1].fulfilled || shortCircuitDueToAction;
    }

    #noopContext() {
        // get and end it right away, we still need to do this for reset() to work correctly
        let validatorContext = this.#getValidatorContext(false);
        this.#validatorContextDone(validatorContext);
    }

    #validatorContextDone = (validatorContext, success = true, errorMessage) => {
        if (!success && !this.#shortCircuit()) {
            this.#validatorState.validationResult._addFailedPath(this.#errorContextValuePath, errorMessage);
            this.#validatorSharedState.failedPaths.push(this.#errorContextValuePath);
        }
        if (this.#contextShortCircuit.sticky) {
            let stickyContext = this.#contextShortCircuit.sticky[this.#contextShortCircuit.sticky.length - 1];
            if (!stickyContext.fulfilled && stickyContext.fulfillValue === success) {
                stickyContext.fulfilled = true;
            }
        }

        this.#reset(validatorContext);
    }

    #enableShortCircuitStickyOn = (successValue) => {
        if (!this.#contextShortCircuit.sticky) {
            this.#contextShortCircuit.sticky = [];
        }
        /*
        * We allow re-entrant shortCircuitSticky calls e.g.
        * test(name).fulfillAllOf((name) => [
        *     name.is.aString(),
        *     name.fulfillAllOf(name => [
        *        ...,
        *        ...
        *     ])
        * ]);
        * */
        this.#contextShortCircuit.sticky.push({
            fulfillValue: successValue,
            fulfilled: false
        });
    }

    #disableShortCircuitSticky = () => {
        this.#contextShortCircuit.sticky.pop();
        if (this.#contextShortCircuit.sticky.length === 0) {
            this.#contextShortCircuit.sticky = undefined;
        }
    }

    /**
     * @param {ValidatorContext} currentValidatorContext
     * @param {*} [contextValue] the value for this validator if <code>undefined</code> the value from the parent will be used
     * @param {string} [contextValuePath] the contextValuePath for this validator if <code>undefined</code> the value from the parent will be used
     * @param {string} [contextValueCurrentPath] the contextValueCurrentPath for this validator if <code>undefined</code> the value from the parent will be used
     * @returns {Validator}
     */
    #createChildValidator(currentValidatorContext, contextValue, contextValuePath, contextValueCurrentPath) {
        let validatorState = this.#validatorState.cloneWith(Validator.#validatorStatePool.get(), contextValue, contextValuePath, contextValueCurrentPath);
        let validator = Validator.#validatorPool.get();
        let shortCircuit = this.#istShortCircuitValidatorContext(currentValidatorContext) || this.#shortCircuit();
        // if the parent is short circuited make sure the child is a well, this goes for e.g. prop()
        validator.#init(validatorState, this.#validatorSharedState, shortCircuit);
        return validator;
    }

    /**
     * @returns {ValidatorContext} the predicate context for this verb
     * @see {@link #does}
     */
    get is() {
        return this.#getValidatorContext(false);
    }

    /**
     * @returns {ValidatorContext} the predicate context for this verb
     * @see {@link #is}
     */
    get does() {
        return this.#getValidatorContext(false);
    }

    /**
     * @returns {ValidatorContext} the predicate context for this verb
     * @see {@link #doNot}
     */
    get isNot() {
        return this.#getValidatorContext(true);
    }

    /**
     * @returns {ValidatorContext} the predicate context for this verb
     * @see {@link #isNot}
     */
    get doesNot() {
        return this.#getValidatorContext(true);
    }

    /**
     * Test the following predicate only if this value is defined. (not <code>null</code> and not  <code>undefined</code>).
     *
     * Descendant predicates added with {@link #each}, {@link ValidatorContext#fulfill}, {@link ValidatorContext#fulfillAllOf},
     * {@link ValidatorContext#fulfillOneOf} will as well only be tested if this value i defined.
     *
     * @example
     * let person = null;
     * // the below tests will only be performed is person i defined
     * test(person).optional.fulfillAllOf((person) => [
     *      person.is.anObject('person must be an object'),
     *      person.prop("name").fulfillAllOf((name) => [
     *          name.is.aString('"${PATH}" must be a string'),
     *          name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     *      ]),
     *      // will only be tested if person is defined and person.age is defined
     *      test(person).optional.prop("age").optional.is.aNumber('"${PATH}" must be a number')
     * ]);
     *
     * @returns {Validator} this instance set to optional mode
     */
    get optional() {
        if (_.isNil(this.#contextValue)) {
            this.#contextShortCircuit.fulfilled = true;
        }
        return this;
    }

    /**
     * Only evaluate the following tests if this predicate is fulfilled.
     *
     * If the predicate is a function the function is passed an instance of an Validator with the current element.
     *
     * @example
     * let person = { name: "John", age: 54 };
     * test(person).fulfillAllOf((person) => [
     *      person.is.anObject('person must be an object'),
     *      person.conditionally((person) => person.prop('name').is.equalTo('Eric')).fulfill(
     *          person.prop('age').is.greaterThan(50, 'Age must be greater that 50 for persons named Eric')
     *      )
     * ]);
     *
     * @param {function(Validator):boolean|boolean} predicate the predicate which must be fulfilled for the following tests to be carried out
     * @returns {Validator} a validator which tests only will be performed if this predicate is fulfilled
     */
    conditionally(predicate) {
        let fulfilled;
        if (_.isFunction(predicate)) {
            // we need a new validator which does not add error messages etc. to the overall context, we only need ot for the predicate result
            let validator = Validator.#instance(Validator.mode.ON_ERROR_BREAK, this.#contextValue, this.#contextValuePath, this.#contextValueCurrentPath,
                "", "", Validator.#noopValidationResult);
            fulfilled = !!predicate(validator);
        } else {
            fulfilled = !!predicate;
        }
        if (!fulfilled) {
            this.#contextShortCircuit.fulfilled = true;
        }
        return this;
    }

    /**
     * Tests the predicate against each element of the iterable.
     *
     * If the predicate is a function the function is passed an instance of an Validator with the current element.
     *
     * @example
     * let numbers = [1, 2, "three", 4];
     * test(numbers).each((number) => element.is.aNumber(),
     *      'The element must be a number but was "${VALUE}"');
     * // we can get the actual value if we need it
     * test(numbers).each((number) => number.value  !== 10 && number.value > 7,
     *      'The number cannot 10 and must be greater than 7');
     * // for more fine grained error message add the error message to the individual test
     * test(numbers).each((number) => number.fulfillAllOf((number) => [
     *      number.is.aNumber('The element must be a number but was "${VALUE}"'),
     *      number.is.inRange(1, 10, 'The element must be in the range [1, 10] was "${VALUE}"'),
     * ]));
     *
     * @param {string} [errorMessage] the error message. If defined and the predicate is not fulfilled an error with the message will be thrown
     * @param {string|string[]} [messageArgs] values for placeholders in the errorMessage
     *  @param {function(Validator)|boolean} predicate a predicate function which returns a boolean or the results of a predicate. Use the passed in validator context to get access to the predicates of this validator
     * @returns {boolean} <code>true</code> if all elements passed the predicate test otherwise <code>false</code>
     */
    each(predicate, errorMessage, messageArgs) {
        // we should always activate the validatorContext and end end it with validatorContextDone
        // to make sure reset() works correctly and the context is returned to the contextPool
        let validatorContext = this.#getValidatorContext(false);
        if (this.#istShortCircuitValidatorContext(validatorContext)) { // getValidatorContext() resets shortCircuitValidatorContexts for us
            return true; // just fulfill right away
        }

        if (_.isNil(this.#contextValue) || !(Symbol.iterator in this.#contextValue)) { // nothing to iterate over, if nothing to test we cannot known, so return false
            Validator.#throwArgumentError('the value must be iterable to use each()');
        }

        let success = true;
        try {
            let i = 0;
            let isArray = Array.isArray(this.#contextValue);
            for (let element of this.#contextValue) {

                let indexPath;
                if (isArray) {
                    indexPath =  `[${i}]`;
                } else {
                    indexPath = `[${element}]`;
                }
                let validator = this.#createChildValidator(validatorContext, element, `${this.#contextValuePath}${indexPath}`, indexPath);
                success = validator.does.fulfill(predicate, errorMessage, messageArgs);
                // on mode = ON_ERROR_NEXT_PATH we need to let the validator handle it so it can collect errors for all paths
                if (!success && this.#validatorState.mode !== sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                    break;
                }
                i++;
            }
        } finally {
            this.#validatorContextDone(validatorContext);
        }
        return success;
    }

    /**
     * @example
     * let person = { name: "John" }
     * let test = Validator.create('Person validation error:');
     * test(person).fulfillAllOf((person) => [
     *      person.is.anObject(),
     *      person.prop('name').fulfillAllOf((name) => [
     *          name.is.aString(),
     *          name.isNot.empty()
     *      ])
     * ], 'person must be an object and must have the property "name" which cannot be empty');
     * @param {string} path the path of the property to make a validator for
     * @returns {Validator}
     */
    prop(path) {
        let validatorContext = this.#getValidatorContext(false);
        let fullPropPath = utils.joinPropPaths(this.#contextValuePath, path);
        let childValue;
        if (!_.isNil(this.#contextValue)) {
            childValue = this.#contextValue[path];
        }
        if (childValue === undefined) { // lodash get() is a little slow, so only use it if needed
            // if parent is optional and nil, _.get() will return undefined, which is fine because createChildValidator sets optional() if parent i optional
            childValue = _.get(this.#contextValue, path);
        }
        let validator = this.#createChildValidator(validatorContext, childValue, fullPropPath, path);
        this.#validatorContextDone(validatorContext); // important to call this to make sure reset() is called and the context is returned to the contextPool, because we are leaving this context and enter a child validator
        return validator;
    }

    /**
     * @returns {*} the value this validator i testing
     */
    get value() {
        let value = this.#contextValue; // get the value before resetting
        this.#noopContext();
        return value;
    }

    /**
     * @example
     * let test = Validator.create();
     * let name = "John";
     * test(name).fulfillAllOf((name) => [
     *      name.is.aString(),
     *      name.transform((name) => name.trim()).isNot.empty()
     * ], 'Name must be a string and name cannot be empty');
     *
     * @param {function(*):Validator} transformer a function for transforming the current value into a new value which should be tested
     * @returns {Validator} a new validator for the transformed value
     */
    transform(transformer) {
        if (!_.isFunction(transformer)) {
            Validator.#throwArgumentError('The argument passed to transform must be a function');
        }

        let validatorContext = this.#getValidatorContext(false);
        let transformedValue = transformer(this.#contextValue);
        // we expect that the transformation is used to just transform the current value, so even though it is possible
        // to return everything, transform should only be used to create transformation of what was at the given path
        let validator = this.#createChildValidator(validatorContext);
        this.#validatorContextDone(validatorContext);
        return validator;
    }

    /**
     * Alias for [does.fulfill]{@link ValidatorContext.fulfill}
     * @param {function(Validator)|boolean} predicate
     * @param {string} [errorMessage]
     * @param {string|string[]} [messageArgs]
     * @returns {boolean} the result of the predicate
     */
    fulfill(predicate, errorMessage, messageArgs) {
        return this.does.fulfill(predicate, errorMessage, messageArgs);
    }

    /**
     * Alias for [does.fulfillOneOf]{@link ValidatorContext.fulfillOneOf}
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates
     * @param {string} [errorMessage]
     * @param {string|string[]} [messageArgs]
     * @returns {boolean}
     */
    fulfillOneOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillOneOf(predicates, errorMessage, messageArgs);
    }

    /**
     * Alias for [does.fulfillAllOf]{@link ValidatorContext.fulfillAllOf}
     * @param {function(Validator)[]|function(Validator):(function(Validator)|boolean)[]} predicates
     * @param {string} [errorMessage]
     * @param {string|string[]} [messageArgs]
     * @returns {boolean}
     */
    fulfillAllOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillAllOf(predicates, errorMessage, messageArgs);
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
            contextValueCurrentPath, errorPrefix, errorBasePath, validationResult);
        validator.#init(validatorState, validatorSharedState);
        return validator;
    }

    /**
     * @typedef {function(value:*):Validator} testFunction
     * @property {ValidationResult} result the result of the performed tests
     */

    /**
     * Creates a new validation context. The returned "test" function gives access to the verb context which return the
     * predicate used for performing the actual test.
     *
     * If a error message is passed to a test predicate it add it to the result if the predicate is not fulfilled.
     * Every predicate returns a boolean with the result of the test.
     *
     * Error message string can use placeholders which will be substituted when the error i thrown
     *
     * @example
     * let test = Validator.create('Validation error:', Validator.mode.ON_ERROR_BREAK);
     * let name = "John";
     * let age = 54;
     * let person = { name: "John", age: 43 };
     * test(name).isNot.nil('Name cannot be null or undefined');
     * test(name).is.aString('Name must be a string');
     * test(name).fulfillAllOf((name) => [
     *      name.value.length > 1,
     *      name.does.match(/\w+/)
     * ], 'Name must have length > 1 and only contain letters');
     *
     * // when testing individual values (or objects) an errorPathPrefix can be passed in a second argument to the the test-function.
     * // the errorPathPrefix will be used a prefix for the path in validation result and for ${PATH} placeholders (see below) in error messages.
     * // This makes it possible to collect errors from multiple values without having them in an object and still be able to tell them appart
     *
     * test(name, 'name').is.aString('Name must be a string');
     * test(age, 'age').is.anInteger('Age must be an integer');
     *
     * console.log(test.result.getError('name'));
     * console.log(test.result.getError('age'));
     *
     * // validate properties of an object
     * test(person).prop("age").is.aNumber('${PATH} must be an string');
     * test(person).fulfillAllOf((person) => [
     *      person.is.anObject('person must be an object'),
     *      person.prop("name").fulfillAllOf((name) => [
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
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @param {string} mode the [mode]{@link Validator.mode} for this validator
     * @see {@link ValidationResult}
     * @see {@link Validator.createOnErrorThrowValidator}
     * @see {@link Validator.createOnErrorBreakValidator}
     * @see {@link Validator.createOnErrorNextPathValidator}
     */
    static create(errorPrefix = '', mode = Validator.mode.ON_ERROR_THROW) {
        return Validator.#testFunction(errorPrefix, mode);
    }

    /**
     * Creates a validator which throws an {@link ValidationError} if a test fails
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link Validator.create} for examples of usage
     * @see {@link Validator.mode}
     */
    static createOnErrorThrowValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_THROW);
    }

    /**
     * Creates a validator which aborts the remaining tests if a test fails
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link Validator.create} for examples of usage
     * @see {@link Validator.mode}
     */
    static createOnErrorBreakValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_BREAK);
    }

    /**
     * Creates a validator which continuous to test the next path if a test fails
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link Validator.create} for examples of usage
     * @see {@link Validator.mode}
     */
    static createOnErrorNextPathValidator(errorPrefix = '') {
        return Validator.#testFunction(errorPrefix, Validator.mode.ON_ERROR_NEXT_PATH);
    }

    static #testFunction(errorPrefix, mode) {
        if (!MODE_VALUES.has(mode)) {
            Validator.#throwArgumentError(`"mode" must be one of [${Array.from(MODE_VALUES).join(', ')}]`);
        }
        let validationResult = new ValidationResult();

        /**
         * The test function
         * @param {*} value the value to test
         * @param {string} [errorBasePath=""] prefix path for the error message placeholder "${PATH}" and error messages in {@link ValidationResult}
         * @returns {Validator}
         */
        let test = (value, errorBasePath = "") => {
            let validator = Validator.#instance(mode, value, "", "", errorPrefix, errorBasePath, validationResult);
            return validator;
        };
        /**
         * @type {ValidationResult}
         */
        test.result = validationResult;
        return test;
    }

    static #throwArgumentError(message) {
        throw new Error(`Validator usage error: ${message}`);
    }

}

module.exports = { Validator };