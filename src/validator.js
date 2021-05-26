const _ = require('lodash');
const { ValidatorPool } = require('./validator-pool');
const { ValidatorContext } = require('./validator-context');
const { ValidationResult } = require('./validation-result');
const sharedConstants = require('./shared-constants');

const POOL_MAX_SIZE = 10;

const PRIVATE_CONSTRUCTOR_KEY = {};

class Validator {

    static #contextPool = new ValidatorPool(POOL_MAX_SIZE,(name) => new ValidatorContext(name), 'ContextPool');
    static #validatorPool = new ValidatorPool(POOL_MAX_SIZE, (name) => new Validator(name, PRIVATE_CONSTRUCTOR_KEY), 'ValidatorPool');
    static #shortCircuitFulfilledValidatorContext = new Proxy(new ValidatorContext(), {
        fulfilledPredicate() {
            return true;
        },
        get: function(target, prop, receiver) {
            return this.fulfilledPredicate; // make all methods of ValidatorContext() return true
        }
    });

    static mode = sharedConstants.mode;

    #name;
    #errorPrefix;
    #mode;
    #validationResult;
    #contextValue;
    #contextValuePath;
    #contextValueCurrentPath;
    #rootValidatorContext;
    #modeSharedState;
    #contextShortCircuit = { fulfilled: false };

    constructor(name, privateConstructorKey) {
        if (privateConstructorKey !== PRIVATE_CONSTRUCTOR_KEY) {
            throw new Error('Use Validator.create*() to create a new validation context');
        }
        this.#name = name;
    }

    #init(errorPrefix = '', mode, validationResult, modeSharedState) {
        this.#errorPrefix = errorPrefix;
        this.#mode = mode;
        this.#validationResult = validationResult;
        if (modeSharedState) {
            this.#modeSharedState = modeSharedState;
        } else {
            this.#modeSharedState = {
                failedPaths: []
            };
        }
    }

    #setContextValue(value, path, currentPath) {
        if (this.#isBusy()) {
            throw new Error('Internal error, the current validator is busy and a new one should have been created or this validator reset. this should never happen!');
        }
        this.#contextValue = value;
        this.#contextValuePath = path;
        if (currentPath) {
            this.#contextValueCurrentPath = currentPath;
        } else {
            this.#contextValueCurrentPath = path;
        }
    }

    #isBusy() {
        return this.#contextValue !== undefined;
    }

    #reset(validatorContext) {
        if (!validatorContext) {
            throw Error('Internal Validator error, validatorContext must be passed to #reset()');
        }

        validatorContext._reset();

        this.#contextShortCircuit.fulfilled = false;

        /* only the root validatorContext can reset the entire validator to idle state
         * otherwise nested methods like fulfillOneOf, fulfillAllOf cannot
         * have multiple conditions when using the passed in Validator
         * because the first condition would then reset the Validator when finishing
         */
        if (this.#rootValidatorContext === validatorContext) {
            this.#errorPrefix = '';
            this.#mode = undefined;
            this.#validationResult = undefined;
            this.#contextValue = undefined;
            this.#contextValuePath = undefined;
            this.#contextValueCurrentPath = undefined;
            this.#rootValidatorContext = undefined;
            this.#modeSharedState = undefined;
            Validator.#validatorPool.return(this);
        }
    }

    #getValidatorContext(notContext) {
        let validatorContext;
        if (this.#shortCircuit()) {
            validatorContext = Validator.#shortCircuitFulfilledValidatorContext;
        } else {
            validatorContext = Validator.#contextPool.get();
            validatorContext._init(this, this.#mode, this.#validationResult, this.#contextValue, this.#contextValuePath, this.#contextValueCurrentPath, this.#errorPrefix,
                notContext, this.#validatorContextDone);
        }
        // we need this to know when we can unset the contextValue see #reset
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

    #shortCircuit() {
        let shortCircuitDueToAction = false;
        if (this.#modeSharedState.failedPaths.length > 0) {
            if (this.#mode === sharedConstants.mode.ON_ERROR_BREAK) {
                shortCircuitDueToAction = true;
            } else if (this.#mode === sharedConstants.mode.ON_ERROR_NEXT_PATH) {
                for (let failedPath of this.#modeSharedState.failedPaths) {
                    if (this.#contextValuePath.startsWith(failedPath)) {
                        shortCircuitDueToAction = true;
                        break;
                    }
                }
            }
        }
        return this.#contextShortCircuit.fulfilled || shortCircuitDueToAction;
    }

    #noopContext() {
        // get and end it right away, we still need to do this for reset() to work correctly
        let validatorContext = this.#getValidatorContext(false);
        this.#validatorContextDone(validatorContext);
    }

    #validatorContextDone = (validatorContext, errorMessage) => {
        if (errorMessage && !this.#shortCircuit()) {
            this.#validationResult._addError(this.#contextValuePath, errorMessage);
            this.#modeSharedState.failedPaths.push(this.#contextValuePath);
        }

        this.#reset(validatorContext);
        if (validatorContext !== Validator.#shortCircuitFulfilledValidatorContext) {
            Validator.#contextPool.return(validatorContext);
        }
    }

    /**
     * @param {ValidatorContext} currentValidatorContext
     * @returns {Validator}
     */
    #createChildValidator(currentValidatorContext) {
        let validator = Validator.#instance(this.#errorPrefix, this.#mode, this.#validationResult, this.#modeSharedState);
        // if the parent is optional and short circuited make sure the child is a well, this goes for e.g. prop()
        if (this.#istShortCircuitValidatorContext(currentValidatorContext) || this.#shortCircuit()) {
            validator = validator.optional;
        }
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
     *      () => person.is.anObject('person must be an object'),
     *      () => person.prop("name").fulfillAllOf((name) => [
     *          () => name.is.aString('"${PATH}" must be a string'),
     *          () => name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
     *      ]),
     *      // will only be tested if person is defined and person.age is defined
     *      () => test(person).optional.prop("age").optional.is.aNumber('"${PATH}" must be a number')
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
     *      () => number.is.aNumber('The element must be a number but was "${VALUE}"'),
     *      () => number.is.inRange(1, 10, 'The element must be in the range [1, 10] was "${VALUE}"'),
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

        if (_.isNil(this.#contextValue)) { // nothing to iterate over, if nothing to test we cannot known, so return false
            this.#validatorContextDone(validatorContext);
            return false;
        } else if (!(Symbol.iterator in this.#contextValue)) {
            this.#throwArgumentError('the value must be iterable to use each()')
        }

        let success = true;
        try {
            let i = 0;
            let isArray = Array.isArray(this.#contextValue);
            for (let element of this.#contextValue) {
                let validator = this.#createChildValidator(validatorContext);
                let indexPath;
                if (isArray) {
                    indexPath =  `[${i}]`;
                } else {
                    indexPath = `[${element}]`;
                }
                validator.#setContextValue(element, `${this.#contextValuePath}${indexPath}`, indexPath);
                success = validator.does.fulfill(predicate, errorMessage, messageArgs);
                if (!success) {
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
     *      () => person.is.anObject(),
     *      () => person.prop('name').fulfillAllOf((name) => [
     *          () => name.is.aString(),
     *          () => name.isNot.empty()
     *      ])
     * ], 'person must be an object and must have the property "name" which cannot be empty');
     * @param path the path of the property to make a validator for
     * @returns {Validator}
     */
    prop(path) {
        let validatorContext = this.#getValidatorContext(false);
        let validator = this.#createChildValidator(validatorContext);
        let fullPath = (this.#contextValuePath === "") ? path : `${this.#contextValuePath}.${path}`;
        validator.#setContextValue(_.get(this.#contextValue, path), fullPath, path); // if parent is optional and nil, _.get() will return undefined, which is fine because createChildValidator set optional() if parent i optional
        this.#validatorContextDone(validatorContext); // important to call this to make sure reset() is called and the context is returned to the contextPool, because we are leaving this context and enter a child validator
        return validator;
    }

    /**
     * @returns {*} the value this validator i testing
     */
    get value() {
        this.#noopContext();
        return this.#contextValue;
    }

    /**
     * @example
     * let test = Validator.create();
     * let name = "John";
     * test(name).fulfillAllOf((name) => [
     *      () => name.is.aString(),
     *      () => name.transform((name) => name.trim()).isNot.empty()
     * ], 'Name must be a string and name cannot be empty');
     *
     * @param {function(*):Validator} transformer a function for transforming the current value into a new value which should be tested
     * @returns {Validator} a new validator for the transformed value
     */
    transform(transformer) {
        if (!_.isFunction(transformer)) {
            this.#throwArgumentError('The argument passed to transform must be a function');
        }

        let validatorContext = this.#getValidatorContext(false);
        let transformedValue = transformer(this.#contextValue);
        let validator = this.#createChildValidator(validatorContext);
        // we expect that the transformation is used to just transform the current value, so even though it is possible
        // to return everything, transform should only be used to create transformation of what was at the given path
        validator.#setContextValue(transformedValue, this.#contextValuePath, this.#contextValueCurrentPath);
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
     * @param {function(Validator)[]|function(Validator):function(Validator)[]} predicates
     * @param {string} [errorMessage]
     * @param {string|string[]} [messageArgs]
     * @returns {boolean}
     */
    fulfillOneOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillOneOf(predicates, errorMessage, messageArgs);
    }

    /**
     * Alias for [does.fulfillAllOf]{@link ValidatorContext.fulfillAllOf}
     * @param {function(Validator)[]|function(Validator):function(Validator)[]} predicates
     * @param {string} [errorMessage]
     * @param {string|string[]} [messageArgs]
     * @returns {boolean}
     */
    fulfillAllOf(predicates, errorMessage, messageArgs) {
        return this.does.fulfillAllOf(predicates, errorMessage, messageArgs);
    }

    #throwArgumentError(message) {
        throw new Error(`ArgValidator usage error: ${message}`);
    }

    /**
     * @param {string} errorPrefix
     * @param {string} mode
     * @param {ValidationResult} validationResult
     * @param {object} [modeSharedState]
     * @returns {Validator}
     */
    static #instance(errorPrefix, mode, validationResult, modeSharedState) {
        let validator = Validator.#validatorPool.get();
        validator.#init(errorPrefix, mode, validationResult, modeSharedState);
        return validator;
    }

    /**
     * Creates a new validation context. The returned "test" function gives access to the verb context which return the
     * predicate used for performing the actual test.
     *
     * If a error message is passed to a test predicate it will throw an error if the predicate is not fulfilled.
     * Every predicate returns a boolean with the result of the test.
     *
     * Error message string can use placeholders which will be substituted when the error i thrown
     *
     * @example
     * let test = Validator.create('Validation error:');
     * let name = "John";
     * let person = { name: "John", age: 43 };
     * test(name).isNot.nil('Name cannot be null or undefined');
     * test(name).is.aString('Name must be a string');
     * test(name).fulfillAllOf((name) => [
     *      () => name.value.length > 1,
     *      () => name.does.match(/\w+/)
     * ], 'Name must have length > 1 and only contain letters');
     *
     * // validate properties of an object
     * test(person).prop("age").is.aNumber('${PATH} must be an string');
     * test(person).fulfillAllOf((person) => [
     *      () => person.is.anObject('person must be an object'),
     *      () => person.prop("name").fulfillAllOf((name) => [
     *          () => name.is.aString('"${PATH}" must be a string'),
     *          () => name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]')
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
     * // the current path for nested properties can be referenced as well
     * test(person).prop("name").prop("length").is.equalTo(1, 'The property "${CURRENT_PATH}": "${VALUE}" of ${PATH} must be 1');
     *
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @returns {function(value:*):Validator} the test function
     */
    static create(errorPrefix = '', mode = Validator.mode.ON_ERROR_THROW) {
        let validationResult = new ValidationResult();
        /**
         * @param {*} value the value to validate
         * @returns {Validator} the validation verb starting point
         */
        let test = (value) => {
            let validator = Validator.#instance(errorPrefix, mode, validationResult);
            validator.#setContextValue(value, "", "");
            return validator;
        }
        test.result = validationResult;
        return test;
    }

    /**
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link #create} for examples of usage
     */
    static createOnErrorThrowValidator(errorPrefix = '') {
        return Validator.create(errorPrefix, Validator.mode.ON_ERROR_THROW);
    }

    /**
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link #create} for examples of usage
     */
    static createOnErrorBreakValidator(errorPrefix = '') {
        return Validator.create(errorPrefix, Validator.mode.ON_ERROR_BREAK);
    }

    /**
     * @param {string} errorPrefix a prefix to prepend to every error thrown by this validator
     * @see {@link #create} for examples of usage
     */
    static createOnErrorNextPathValidator(errorPrefix = '') {
        return Validator.create(errorPrefix, Validator.mode.ON_ERROR_NEXT_PATH);
    }

}

module.exports = { Validator };