# Validator

A fluent validator API for validating function arguments, form-data etc. 

## Installation
```
npm install @chcaa/validator
```

## Getting Started
Import the module and create a new `Validator` (see examples further down for different kinds of validators).
```js
const { Validator } = require('@chcaa/validator');
let test = Validator.createOnErrorThrowValidator();
let name = "Peter";
test(name).fulfillAllOf(name => [
    name.is.aString('"name" must be a string'),
    name.is.equalTo('Peter', '"name" must be "Peter"')
]);
```
See also the JsDoc for each method for further examples.

## Test Function Arguments
If an argument does not meet the requirements we want to throw a `ValidationError` so we 
create a `Validator` which throws an error when a test fails.

```js
function add(x, y) {
    let test = Validator.createOnErrorThrowValidator('Argument error for add');
    test(x).is.aNumber('x must be a number bus was ${VALUE}');
    test(y).is.aNumber('y must be a number bus was ${VALUE}');
}
```

## Test Form Data and Objects
When testing form data we would like to be able to gather information and show it to the user. We can then
create a `Validator` which just breaks if a test fails instead of throwing an Error. To keep
the error messages separated in the `ValidationResult` we supply an `errorPrefixPath` as the second argument to `test`.

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
    if (!test.result.isValid()) {
        console.log(test.result.getAllErrors());
        // or
        console.log(test.result.getError('username'));
        console.log(test.result.getError('age'));
    }
}
````

The data from above could also be validated as an object instead of individual values, we then make use of 
a `Validator` in `ON_ERROR_NEXT_PATH` mode to move on to the next path when a test fails, so we can gather
information about all paths. If we only wanted the error message for the first path which failed we 
could use an `ON_ERROR_BREAK` `Validator`. 

```js
function validateUserForm(user) {
    let test = Validator.createOnErrorBreakValidator();
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
    if (!test.result.isValid()) {
        console.log(test.result.getAllErrors());
        // or
        console.log(test.result.getError('username'));
        console.log(test.result.getError('age'));
    }
}
```

## Reusing Rules
Rules can be stored and reused using a `RuleSet`. 

For objects a single set of rules for whole object can be applied using `Validator.prop()` to access
each property, as the examples above, but  it is more performant and sometimes easier to read 
if rules are divided by each property and added separately.

 
```js
let ruleSet = Validator.createOnErrorBreakRuleSet();
ruleSet.addRule('username', (username) => username.fulfillAllOf(username => [
    username.is.aString('Username must be a string'),
    username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
]));
ruleSet.addRule('age', (age) => age.fulfillAllOf(age => [
    age.is.anInteger('Age must be an integer'),
    age.is.inRange(0, 120, 'Age must be in range 0 - 120')
]));

// simple test if a user is valid
if (ruleSet.isValid(user)) {
    // do something usefull here
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
let ageIsValid = ruleSet.isValidValue(23, 'age');
validationResult = ruleSet.validateValue(23, 'age');
```


## Error Messages
Error messages can be supplied for the individual test and as combined messages for `fulfill()`, `fulfillAllOf()`, `fulfillOneOf()` and `each()`.

Individual messages is supplied as an argument to the test:
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
When using combined messages it is important not to add individual messages as well as these will overrule the combined message.

All error messages for the same `Validator` can have the same prefix which can be provided when creating the `Validator`.
```js
let test = Validator.createOnErrorBreakValidator('Name error');
test('Peter').fulfillAllOf(peter => [
    peter.is.aString('must be a string'),
    peter.is.equalTo('Peter', 'must equal "Peter"')
]);
```


### Arguments

Arguments for error messages can be passed in as an array of values and be referenced by their index number.
```js
let person = { name: "Peter", age: 41 };
let test = Validator.createOnErrorNextPathValidator('Person error');
test(person).prop('age').is.inRange(18, 99, 'The age must be in range ${0} - ${1}', [18, 99]);
```

### Context Placeholders
The different paths and values in the current validation context can be referenced in the error messages using the following
placeholders:

- `${VALUE}` - the value currently being testet
- `${PATH}` - the full path of the current value under test including `errorPrefixPath` if supplied
- `${CURRENT_PATH}` - the path for the current value under test
- `${PARENT_PATH}` - the parent of `${CURRENT_PATH}`

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
```

## Validator Factory Methods
- `Validator.create(erorPrefix, mode):testFunction` - Creates a new validation context with the given mode. 
  The returned "test" function gives access to the verb context 
  which return the predicate used for performing the actual tests
- `Validator.createOnErrorThrowValidator(errorPrefix):testFunction` - Creates a new validation context which throws an `ValidationError` if a test fails
- `Validator.createOnErrorBreakValidator(errorPrefix):testFunction` - Creates a new validation context which breaks if a test fails
- `Validator.createOnErrorNextPathValidator(errorPrefix):testFunction` - Creates a new validation context which moves on to the next path if a test fails
- `Validator.createRuleSet(errorPrefix):RuleSet` - Creates a `RuleSet` with the given mode
- `Validator.createOnErrorThrowRuleSet(errorPrefix):RuleSet` - Creates a `RuleSet` which throws an `ValidationError` if a test fails
- `Validator.createOnErrorBreakRuleSet(errorPrefix):RuleSet` - Creates a `RuleSet` which breaks if a test fails
- `Validator.createOnErrorNextPathRuleSet(errorPrefix):RuleSet` - Creates a `RuleSet` which moves on to the next path if a test fails

## Validator Overview
- `does:ValidatorContext`
- `doesNot:ValidatorContext`
- `is:ValidatorContext`
- `isNot:ValidatorContext`
- `optional:Validator` - only validate the following predicates if the current value i not `nil`
- `value:*` - returns the actual value for this context
- `conditionally(predicate(validator)):Validator` - only validate the following predicates if the predicate is fulfilled
- `each(predicate, [errorMessage, [messageArgs]]):boolean` - validate each element in the `iterable` against the predicate
- `transform(tranformer):Validator` - transform the current value into something else, e.g. making a `string` lowercase
- `prop(path):Validator` - get a `Validator` for the `path` relative to the current context value (typically an object)
- `fulfill(predicate):ValidatorContext` - alias for `does.fulfill()`
- `fulfillOneOf(predicates):ValidatorContext` - alias for `does.fulfillOneOf()`
- `fulfillAllOf(predicates):ValidatorContext` - alias for `does.fulfillAllOf()`

## ValidatorContext Overview
All methods take an optional `errorMessage` and `messageArgs` as the last two arguments and all methods
returns a `boolean`.

- `anArray()`
- `aBoolean()`
- `aFloatString()`
- `anInteger()`
- `anIntegerString()`
- `aNumber()`
- `anObject()`
- `aString()`
- `empty()`
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

## RuleSet Overview
- TODO lav denne
## ValidationResult Overview
NOTE: If a test for at path do not provide an error message  use 
`isValid()` and `isPathValid()` to test if the path is valid or not. 

- `getError(path):string` - get the first error for the given path.
- `getErrors(path):string[]` - get all errors for the given path
- `getAllErrors():string[]` - get all errors
- `isValid():boolean` - `true` of there is no errors otherwise `false`
- `isPAthValid(path):boolean` - is the given path valid
- `reset()` - resets the validation result. (not relevant in the context of a RuleSet as this always creates a new instance for every test) 
