# Validator

A fluent validator API for validating function arguments, form-data etc.

## Installation

```
npm install @chcaa/validator
```

## Getting Started

Import the module and create a new `Validator` (see examples further down for different kinds of validators).

```js
import { Validator } from '@chcaa/validator';

let test = Validator.createOnErrorThrowValidator();

let person = {
    name: "Peter"
};
test(person.name).fulfillAllOf(name => [
    name.is.aString('"name" must be a string'),
    name.is.equalTo('Peter', '"name" must be "Peter"')
]);

// or make a set of reusable rules
let ruleSet = Validator.createOnErrorNextPathRuleSet();
ruleSet.addRule('name', (name) => name.fulfillAllOf(name => [
    name.is.aString('"name" must be a string'),
    name.is.equalTo('Peter', '"name" must be "Peter"')
]));

let validationResult = ruleSet.validate(person);
console.log(validationResult.getAllErrors());
```

See also the JsDoc for each method for further examples.

## Test Function Arguments

If an argument does not meet the requirements, we want to throw a `ValidationError` so we
create a `Validator` which throws an error when a test fails.

```js
function add(x, y) {
    let test = Validator.createOnErrorThrowValidator('Argument error for add');
    test(x).is.aNumber('x must be a number but was ${VALUE}');
    test(y).is.aNumber('y must be a number but was ${VALUE}');
}
```

## Test Form Data and Objects

When testing form data, we would like to be able to gather information and show it to the user. We can then
create a `Validator` which just breaks if a test fails instead of throwing an Error. To keep
the error messages separated in the `ValidationResult`, we supply an `errorPrefixPath` as the second argument to `test`.

````js
function validateUserForm(username, age) {
    let test = Validator.createOnErrorBreakValidator();
    test(username, 'username').fulfillAllOf(username => [
        username.is.aString('Username must be a string'),
        username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
    ]);
    test(age, 'age').fulfillAllOf(age => [
        age.is.anInteger('Age must be an integer'),
        age.is.inRange(0, 120, 'Age must be in range 0 - 120')
    ]);
    // show the errors to the user
    let validationResult = Validator.validationResult(test);
    if (!validationResult.isValid()) {
        console.log(validationResult.getAllErrors());
        // or
        console.log(validationResult.getError('username'));
        console.log(validationResult.getError('age'));
    }
}
````

The data from above could also be validated as an object instead of individual values, we then make use of
a `Validator` in `ON_ERROR_NEXT_PATH` mode to move on to the next path when a test fails, so we can gather
information about all paths. If we only wanted the error message for the first path which failed, we
could use an `ON_ERROR_BREAK` `Validator`.

```js
function validateUserForm(user) {
    let test = Validator.createOnErrorNextPathValidator();
    test(user).fulfillAllOf(user => [
        user.prop('username').fulfillAllOf(username => [
            username.is.aString('Username must be a string'),
            username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
        ]),
        user.prop('age').fulfillAllOf(age => [
            age.is.anInteger('Age must be an integer'),
            age.is.inRange(0, 120, 'Age must be in range 0 - 120')
        ])
    ]);
    // show the errors to the user
    let validationResult = Validator.validationResult(test);
    if (!validationResult.isValid()) {
        console.log(validationResult.getAllErrors());
        // or
        console.log(result.getError('username'));
        console.log(result.getError('age'));
        //
        for (let path of validationResult.errorPaths()) {
            console.log(validationResult.getError(path));
        }
    }
}
```

## Reusing Rules

Rules can be stored and reused using a `RuleSet`.

For objects, a single set of rules for a whole object can be applied using `Validator#prop()` to access
each property, as the examples above, but it is more performant and sometimes easier to read
if rules are divided by each property and added separately.

```js
let ruleSet = Validator.createOnErrorBreakRuleSet();
ruleSet.addRule('username', username => username.fulfillAllOf(username => [
    username.is.aString('Username must be a string'),
    username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
]));
ruleSet.addRule('age', (age) => age.fulfillAllOf(age => [
    age.is.anInteger('Age must be an integer'),
    age.is.inRange(0, 120, 'Age must be in range 0 - 120')
]));

let user = {
    username: 'johndoe',
    age: 45
}

// simple test if a user is valid
if (ruleSet.isValid(user)) {
    // do something useful here
}

// or get detailed validation results
let validationResult = ruleSet.validate(user);
console.log(validationResult.getAllErrors()); // all erros
console.log(validationResult.getError('age')); // first error
console.log(validationResult.getErrors('age')); // all errors for path

// we can also test individual paths 
if (ruleSet.isValid(user, 'age')) {
    // do something
}
// or validate and get a result only for a single path
validationResult = ruleSet.validate(user, 'age');

// values can also be validated directly against paths
let ageIsValid = ruleSet.isValueValid(23, 'age');
validationResult = ruleSet.validateValue(23, 'age');
```

### Supplying Values not Known at the Time of Rule Creation

When creating rules for reuse, some values may not be known at the time the rule is created because they are unknown or change
regularly. Or we could want to create a generic set of rules which can be used in different contexts.
"Context" values can be passed-in to a rule at validation time and referenced by the rule by adding a second
parameter to the rule function as shown in the below example.

```js
let ruleSet = Validator.createOnErrorBreakRuleSet();
ruleSet.addRule('username', (username, reservedUsernames) => username.fulfillAllOf(username => [
    username.is.aString('Username must be a string'),
    username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters"),
    username.isNot.in(reservedUsernames, '${VALUE} is a reserved username')
]));

let reservedUsernames = await fetchReservedUsernames(); // fetch reserved usernamed from some server

let user = {
    username: 'admin'
}

ruleSet.validate(user, 'username', reservedUsernames); // we pass in the "context" arg as the third object to validate
// if we want to validate all paths for an object and need to supply a context argument, we need to pass in "undefined"
// for the "path" parameter. (in this case both examples gives the same result as we only have a rule for "username")
ruleSet.validate(user, undefined, reservedUsernames);
```

## Error Messages

Error messages can be supplied for the individual test and as combined messages for `fulfill()`, `fulfillAllOf()`, `fulfillOneOf()` and `each()`.

Individual messages are supplied as an argument to the test:

```js
let test = Validator.createOnErrorBreakValidator();
test('Peter').is.equalTo('Peter', `"Peter" must be equal to "Peter"`);
```

Combined messages is supplied as a second argument to e.g. `fulfillAllOf()`:

```js
let test = Validator.createOnErrorBreakValidator();
test('Peter').fulfillAllOf(peter => [
    peter.is.aString(),
    peter.is.equalTo('Peter')
], '"Peter" must be a string and be equal to "Peter"');
```

When using combined messages, it is important **not** to add individual messages as well as these will overrule the combined message.

All error messages for the same `Validator` can have the same prefix which can be provided when creating the `Validator`.

```js
let test = Validator.createOnErrorBreakValidator('Name error');
test('Peter').fulfillAllOf(peter => [
    peter.is.aString('must be a string'),
    peter.is.equalTo('Peter', 'must equal "Peter"')
]);
```

### Arguments

Arguments for error messages can be passed in as a single value (if only one is needed) or as an array of values and be
referenced by their index number.

`string`, `number`, and `array` or `Set` of `string` and `number` is
allowed. An `array` and `Set` of values will be inserted in `JSON` format e.g. `["string", 3, 4, "string2"]`.
When passing an `array` of values it must always be passed in a surrounding `array`, even if only a single
argument is needed, to be able to distinguish between an `array` of arguments and an `array` of values.

```js
let person = { name: "Peter", age: 41 };
let test = Validator.createOnErrorNextPathValidator('Person error');
test(person).prop('age').is.inRange(18, 99, 'The age must be in range ${0} - ${1}', [18, 99]);
```

### Context Placeholders

The different paths and values in the current validation context can be referenced in the error messages using the following
placeholders:

- `${VALUE}` - The value currently being tested.
- `${PATH}` - The full path of the current value under test, including `errorPrefixPath` and `errorContextPaths` if supplied.
- `${PATHx}` - The full path at index `x` of the current value under test when multiple `errorContextPaths` is supplied using `Validator#errorContext()`.
- `${CURRENT_PATH}` - The path for the current value under test.
- `${PARENT_PATH}` - The full parent path of `${CURRENT_PATH}`.

```js
let person = { name: "Peter", age: 41 };
let test = Validator.createOnErrorNextPathValidator('Person error');
test(person).fulfillAllOf(person => [
    person.prop('name').fulfillAllOf(name => [
        name.is.aString('${PATH} must be a string but was ${VALUE}'),
        name.prop('length').is.inRange(4, 25, 'The ${CURRENT_PATH} of ${PARENT_PATH} must be 4 - 25 but was ${VALUE}')
    ])
]);

// test individual values and use the `errorPrefixPath` to get the same result as above
test(person.name, 'name').fulfillAllOf(name => [
    name.is.aString('${PATH} must be a string but was ${VALUE}'),
    name.prop('length').is.inRange(4, 25, 'The ${CURRENT_PATH} of ${PARENT_PATH} must be 4 - 25 but was ${VALUE}')
]);

// test values together and add the error for both paths if the test fails
test(person).errorContext('name', 'age').fulfillOneOf(person => [
    person.prop('name').isNot.nil(),
    person.prop('age').isNot.nil()
], 'At least one of ${PATH0} or ${PATH1} must have a value');
// if the test fails both path will have the error
let validationResult = Validator.validationResult(test);
console.log(validationResult.getErrors('name'));
console.log(validationResult.getErrors('age'));

```

## Debugging

Debug messages can be toggled on and off by calling `Validator.debug(true|false)`.

## Validator Factory and Static Methods

- `Validator.create(errorPrefix, mode): testFunction` - Creates a new validator with the given mode.
  The returned "test" function gives access to the verb context, which returns the predicate used for performing the actual tests.
- `Validator.createOnErrorThrowValidator(errorPrefix): testFunction` - Creates a new validator which throws an `ValidationError` if a test fails.
- `Validator.createOnErrorBreakValidator(errorPrefix): testFunction` - Creates a new validator which breaks if a test fails.
- `Validator.createOnErrorNextPathValidator(errorPrefix): testFunction` - Creates a new validator which moves on to the next path if a test fails.
- `Validator.createRuleSet(errorPrefix): RuleSet` - Creates a `RuleSet` with the given mode.
- `Validator.createOnErrorThrowRuleSet(errorPrefix): RuleSet` - Creates a new `RuleSet` which throws an `ValidationError` if a test fails.
- `Validator.createOnErrorBreakRuleSet(errorPrefix): RuleSet` - Creates a new `RuleSet` which breaks if a test fails.
- `Validator.createOnErrorNextPathRuleSet(errorPrefix): RuleSet` - Creates a new `RuleSet` which moves on to the next path if a test fails.
- `Validator.validationResult(testFunction)` - Get the `ValidationResult` of the test function.
- `Validator.debug(true|false)` - enable / disable debugging messages.

## Validator Overview

- `does: ValidatorContext`
- `doesNot: ValidatorContext`
- `is: ValidatorContext`
- `isNot: ValidatorContext`
- `optional: Validator` - Only validate the following predicates if the current value is *not* `nil` (`null` or `undefined`).
- `optionalNull: Validator` - Only validate the following predicates if the current value is *not* `null`.
- `optionalUndefined: Validator` - Only validate the following predicates if the current value is *not* `undefined`.
- `value: *` - The actual value for this context.
- `conditionally(predicate(validator)): Validator` - Only validate the following tests if the passed in predicate is fulfilled.
- `each(predicate, [errorMessage, [messageArgs]]): boolean` - Validate each element in the `iterable` against the predicate.
- `transform(tranformer): Validator` - Transform the current value into something else, e.g., making a `string` lowercase.
- `prop(path): Validator` - Get a `Validator` for the `path` relative to the current context value (typically an object).
- `errorContext(...contextPath)` - Rewrite the error context for the current validator context making it possible to change which path(s) should fail on error.
- `fulfill(predicate): ValidatorContext` - Alias for `does.fulfill()`.
- `fulfillOneOf(predicates): ValidatorContext` - Alias for `does.fulfillOneOf()`.
- `fulfillAllOf(predicates): ValidatorContext` - Alias for `does.fulfillAllOf()`.

## ValidatorContext Overview

All methods take an optional `errorMessage` and `messageArgs` as the last two arguments, and all methods
return a `boolean`.

- `anArray()`
- `aBoolean()`
- `aFloatString()`
- `aFunction()`
- `anInteger()`
- `anIntegerString()`
- `aNumber()`
- `anObject()`
- `aString()`
- `empty()`
- `endWith(endStr)`
- `equalTo(otherValue)`
- `fulfill(predicate)`
- `fulfillAllOf(predicates)`
- `fulfillOneOf(predicates)`
- `greaterThan(value)`
- `greaterThanOrEqualTo(value)`
- `identicalTo(otherValue)`
- `in(values)`
- `inRange(start, end)`
- `lessThan(value)`
- `lessThanOrEqualTo(value)`
- `match(regex)`
- `nil()`
- `startWith(startStr)`

## RuleSet Overview

- `addRule(path, rule): RuleSet` - Add a rule for the given path to the `RuleSet` in the form of a function which will be called when rule is tested.
- `isValid(object, [path]): boolean` - Test if the property paths of the object are valid. The path or paths to test can be optionally passed in as the second
  argument.
- `isValueValid(value, [path]): boolean` - Test if the value is valid. The path or paths to test can be optionally passed in as the second argument.
- `validate(object, [[path, [isObject]]): ValidationResult` - Validate the object which, depending on the mode of the `RuleSet`, will produce
  a `ValidationResult` with errors or throw an `ValidationError` if the object is not valid.
- `validateValue(value, [path]): ValidationResult` - Validate the value which depending on the mode of the `RuleSet` will produce a `ValidationResult` with
  errors or throw an `ValidationError`if the object is not valid.

## ValidationResult Overview

- `getError(path): string` - Get the first error for the given path.
- `getErrors(path): string[]` - Get all errors for the given path.
- `getAllErrors(): string[]` - Get all errors.
- `errorPaths(): Iterable<string>` - The paths with errors.
- `isValid(): boolean` - `true` of there is no errors otherwise `false`.
- `isPathValid(path): boolean` - `true` if the given path is valid otherwise `false`.
- `reset()` - Reset the validation result. (Not relevant in the context of a RuleSet as this always creates a new instance for every test).

[//]: # (TODO Add section for Predicate function)

[//]: # (TODO Add section for Transform function)