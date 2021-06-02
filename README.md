# Validator

A fluent validator API for validating function arguments, form-data etc. 

## Installation
```
npm install @chcaa/validator
```

## Getting Started
Import the module and create a new `Validator` (see examples further down for different kinds of validators).
```ecmascript 6
const { Validator } = require('@chcaa/validator');
let test = Validator.createOnErrorThrowValidator();
let name = "Peter";
test(name).fulfillAllOf(name => [
    () => name.is.aString('"name" must be a string'),
    () => name.is.equalTo('Peter', '"name" must be "Peter"')
]);
```
See also the JsDoc for each method for further examples.

## Test Function Arguments
If an argument does not meet the requirements we want to throw a `ValidationError` so we 
create a `Validator` which throws an error when a test fails.

```ecmascript 6
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

````ecmascript 6
function validateUserForm(username, age) {
    let test = Validator.createOnErrorBreakValidator();
    test(username, 'username').fulfillAllOf(username => [
        () => username.is.aString('Username must be a string'),
        () => username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
    ]);
    test(age, 'age').fulfillAllOf(age => [
        () => age.is.anInteger('Age must be an integer'),
        () => age.is.inRange(0, 120, 'Age must be in range 0 - 120')
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

```ecmascript 6
function validateUserForm(user) {
    let test = Validator.createOnErrorBreakValidator();
    test(user).fulfillAllOf(user => [
        user.prop('username').fulfillAllOf(username => [
            () => username.is.aString('Username must be a string'),
            () => username.does.match(/\w{4, 25}/, "Username must only contain a-zA-Z0-9_ and have a length of 4-25 characters")
        ]),
        user.prop('age').fulfillAllOf(age => [
            () => age.is.anInteger('Age must be an integer'),
            () => age.is.inRange(0, 120, 'Age must be in range 0 - 120')
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

## Error Messages
Error messages can be supplied for the individual test and as combined messages for `fulfill()`, `fulfillAllOf()`, `fulfillOneOf()` and `each()`.

Individual messages is supplied as an argument to the test:
```ecmascript 6
let test = Validator.createOnErrorBreakValidator();
test('Peter').is.equalTo('Peter', `"Peter" must be equal to "Peter"`);
```
Combined messages is supplied as a second argument to e.g. `fulfillAllOf()`:
```ecmascript 6
let test = Validator.createOnErrorBreakValidator();
test('peter').fulfillAllOf(peter => [
    peter.is.aString(),
    peter.is.equalTo('peter')
], '"Peter" must be a string and be equal to "Peter"');
```
When using combined messages it is important not to add individual messages as well as these will overrule the combined message.

All error messages for the same `Validator` can have the same prefix which can be provided when creating the `Validator`.
```ecmascript 6
let test = Validator.createOnErrorBreakValidator('Name error');
test('peter').fulfillAllOf(peter => [
    peter.is.aString('must be a string'),
    peter.is.equalTo('peter', 'must equal "Peter"')
]);
```


### Arguments

Arguments for error messages can be passed in as an array of values and be referenced by their index number.
```ecmascript 6
let person = { name: "peter", age: 41 };
let test = Validator.createOnErrorNextPathValidator('Person error');
test(person).prop('age').is.inRange(18, 99, 'The age must be in range ${0} - ${1}', [18, 99])
```

### Context Placeholders
The different paths and values in the current validation context can be referenced in the error messages using the following
placeholders:

- `${VALUE}` - the value currently being testet
- `${PATH}` - the full path of the current value under test including `errorPrefixPath` if supplied
- `${CURRENT_PATH}` - the path for the current value under test
- `${PARENT_PATH}` - the parent of `${CURRENT_PATH}`

```ecmascript 6
let person = { name: "peter", age: 41 };
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
])
```

    
