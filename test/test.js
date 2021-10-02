const { Validator } = require('../src/validator');
const _ = require('lodash');

try {
    let t = Validator.createOnErrorThrowValidator();
    let validator = (val) => val.optional.fulfillAllOf(val => [
        val.is.aNumber()
        ]
    )
    t([undefined, 10]).each(validator, "bad");
    return;


    let pers = {
        name: 2
    };
    let ruleSet = Validator.createOnErrorNextPathRuleSet('ding');
    ruleSet.addRule('', (person) => person.fulfillAllOf((person) => [
        person.is.anObject('person must be an object')
    ]));
    ruleSet.addRule('name', (name) => name.fulfillAllOf((name) => [
        name.is.aString('${PATH} must be a string'),
        name.isNot.empty('name cannot be empty')
    ]));


    /*console.time('te')
    for (let i = 0; i < 100_000; i++) {

        ruleSet.isValid(pers);
    }
    console.timeEnd('te')
    console.log(ruleSet.validate(pers).getError('name'))*/
    //console.log(ruleSet.validate(pers, '').getAllErrors())

    console.log(ruleSet.validate(pers, 'name').toString())


    let test = Validator.create('test error:', Validator.mode.ON_ERROR_NEXT_PATH);
    test(3).is.aString()
    test.result.isValid();

   /* let name = "";
    test(name).isNot.nil('Name cannot be null or undefined');
    test(name).is.aString('Name must be a string');
    test(name).optional.fulfillAllOf((name) => [
            name.is.aString(),
            name.does.match(/\w+/)
        ],
        'Name must have length > 1 and only contain letters'
    );

    test(name).fulfillAllOf((name) => [
        name.is.aString(),
        name.is.aNumber('must be a number'),
        name.is.in(['John', 'Michael'])
    ], 'The name must be a string and one of "John" or "Michael"');

    let numbers = [1, 2, 3, 4, 5, 6, 7, 8];
    //test(numbers).each((element) => element.is.aNumber(), 'Must be a number but was "${VALUE}"');


    test(numbers).optional.each((number) => number.fulfillAllOf((number) => [
        number.is.aNumber('The element must be a number but was "${VALUE}"'),
        number.is.inRange(1, 10, 'The element must be in the range [1, 10] but was "${VALUE}"'),
    ]));

*/

 /*
    console.time("t");
   let person = { name: "", age: "54" };
    for (let i = 0; i < 100000; i++) {

    test(person, 'person').fulfillAllOf((person) => [
        person.is.anObject('person must be an object'),
        person.prop('name').fulfillAllOf((name) => [
            name.is.aString('"${PATH}" must be a string'),
            name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]'),
            name.is.equalTo('ding', "${PATH} must be 'ding'")
        ]),
        person.prop("age").optional.is.aNumber('"${PATH}" must be a number')
    ]);
    }
    console.timeEnd("t")
*/
    //test(person).prop('name').prop('length').is.equalTo(4, "${CURRENT_PATH} of ${PATH} must have en length of 1");


    /*let person = { name: "Eric", age: 49 };
    test(person).fulfillAllOf((person) => [
        person.is.anObject('person must be an object'),
        person.conditionally((person) => person.value.name === 'Eric').fulfill(
            person.prop('age').is.greaterThan(50, 'Age must be greater that 50 for persons named Eric')
        )
    ]);
    console.log(test.result.getAllErrors());*/

} catch (e) {
    console.error(e);
}



let person = { name: "John", age: 54, ssn: undefined };

let test = Validator.createOnErrorThrowValidator('Person validation error');


/*test(person).fulfillAllOf((person) => [
    person.is.anObject('person must be an object'),
    person.prop('name').fulfillAllOf((name) => [
        name.is.aString('${PATH} must be a string'),
        name.transform((name) => name.trim()).isNot.empty('${PATH} cannot be empty')
    ]),
    person.prop('age').is.aNumber('${PATH} must be a number'),
    person.prop('ssn').optional.fulfillAllOf((ssn) => [
        ssn.is.aString('${PATH} must be a string or undefined'),
        ssn.does.match(/^\d{6}-?\d{4}$/, '${PATH} must match xxxxxx-xxxx')
    ])
]);*/


test(person).fulfillAllOf(person => [
    person.is.anObject(),
    person.fulfillAllOf(person => [
        person.is.anObject(),
    ])
], "bang")

//problemet er måske at vi i conditionally laver en noopValidationResult object??
test(person).fulfillAllOf(person => [
    person.conditionally(person => person.is.equalTo(person.value)).prop('name').fulfillAllOf(name => [
        name.is.aNumber("name must be a int"),
    ])
]);

test(person).fulfillAllOf(person => [
    person.conditionally(() => true).prop('name').fulfillAllOf(name => [
        name.is.aString("name must be a sintr"),
        name.is.aNumber('Name must be a number')
    ])
]);

console.log(test.result.isValid());
console.log(test.result.getAllErrors())

/*for (let i = 0; i < 100; i++) {

    console.time('t');

    if (!_.isObject(person)) {
        throw new Error('person must be an object');
    }
    if (!_.isString(person.name)) {
        throw new Error('name must a string')
    }
    if (person.name.trim() === '') {
        throw new Error('name cannot be empty');
    }
    if (!_.isNumber(person.age)) {
        throw new Error('age must be a number');
    }
    if (person.ssn !== undefined) {
        if (!_.isString(person.ssn)) {
            throw new Error('ssn must be a string');
        }
        if (!person.ssn.match(/^\d{6}-?\d{4}$/)) {
            throw new Error('ssn must match xxxxxx-xxxx')
        }
    }
    console.timeEnd('t')
}*/



