const { Validator } = require('../src/validator');
const _ = require('lodash');

try {
    let test = Validator.create('test error:', Validator.mode.ON_ERROR_NEXT_PATH);

   /* let name = "";
    test(name).isNot.nil('Name cannot be null or undefined');
    test(name).is.aString('Name must be a string');
    test(name).optional.fulfillAllOf((name) => [
            () => name.is.aString(),
            () => name.does.match(/\w+/)
        ],
        'Name must have length > 1 and only contain letters'
    );

    test(name).fulfillAllOf((name) => [
        () => name.is.aString(),
        () => name.is.aNumber('must be a number'),
        () => name.is.in(['John', 'Michael'])
    ], 'The name must be a string and one of "John" or "Michael"');

    let numbers = [1, 2, 3, 4, 5, 6, 7, 8];
    //test(numbers).each((element) => element.is.aNumber(), 'Must be a number but was "${VALUE}"');


    test(numbers).optional.each((number) => number.fulfillAllOf((number) => [
        () => number.is.aNumber('The element must be a number but was "${VALUE}"'),
        () => number.is.inRange(1, 10, 'The element must be in the range [1, 10] but was "${VALUE}"'),
    ]));

*/

 /*
    console.time("t");
   let person = { name: "", age: "54" };
    for (let i = 0; i < 100000; i++) {

    test(person, 'person').fulfillAllOf((person) => [
        () => person.is.anObject('person must be an object'),
        () => person.prop('name').fulfillAllOf((name) => [
            () => name.is.aString('"${PATH}" must be a string'),
            () => name.does.match(/\w+/, '"${PATH}" must only contain [a-Z_0-9]'),
            () => name.is.equalTo('ding', "${PATH} must be 'ding'")
        ]),
        () => person.prop("age").optional.is.aNumber('"${PATH}" must be a number')
    ]);
    }
    console.timeEnd("t")
*/
    //test(person).prop('name').prop('length').is.equalTo(4, "${CURRENT_PATH} of ${PATH} must have en length of 1");


    /*let person = { name: "Eric", age: 49 };
    test(person).fulfillAllOf((person) => [
        () => person.is.anObject('person must be an object'),
        () => person.conditionally((person) => person.value.name === 'Eric').fulfill(
            () => person.prop('age').is.greaterThan(50, 'Age must be greater that 50 for persons named Eric')
        )
    ]);
    console.log(test.result.getAllErrors());*/

} catch (e) {
    console.error(e);
}


/*
let person = { name: "John", age: 54, ssn: undefined };

let test = ArgValidator.create('Person validation error:');

for (let i = 0; i < 100; i++) {

    console.time('t');
    test(person).fulfillAllOf((person) => [
        () => person.is.anObject('person must be an object'),
        () => person.prop('name').fulfillAllOf((name) => [
            () => name.is.aString('${PATH} must be a string'),
            () => name.transform((name) => name.trim()).isNot.empty('${PATH} cannot be empty')
        ]),
        () => person.prop('age').is.aNumber('${PATH} must be a number'),
        () => person.prop('ssn').optional.fulfillAllOf((ssn) => [
            () => ssn.is.aString('${PATH} must be a string or undefined'),
            () => ssn.does.match(/^\d{6}-?\d{4}$/, '${PATH} must match xxxxxx-xxxx')
        ])
    ]);
    console.timeEnd('t');
}

for (let i = 0; i < 100; i++) {

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
}
*/

/*
* eksempler på andre validator tilgange og hastigheder: https://github.com/icebob/validator-benchmark/blob/master/suites/simple.js
* */


function testOther() {

        const Joi = require('joi');

    const obj = {
        name: "John Doe",
        email: "john.doe@company.space",
        firstName: "John",
        phone: "123-4567",
        age: 33
    };

        const constraints = Joi.object().keys({
            name: Joi.string().min(4).max(25).required(),
            email: Joi.string().required(),
            firstName: Joi.required(),
            phone: Joi.required(),
            age: Joi.number().integer().min(18).required()
        });


        console.time('t');
        for (let i = 0; i < 100; i++) {

            constraints.validate(obj);
        }
        console.timeEnd('t')

}

testOther();

function testFastest() {
    const obj = {
        name: "John Doe",
        email: "john.doe@company.space",
        firstName: "John",
        phone: "123-4567",
        age: 33
    };
    const Validator = require('fastest-validator');
    const v = new Validator();

    const constraints = {
        name: {
            type: "string",
            min: 4,
            max: 25
        },
        email: { type: "string" },
        firstName: { type: "string" },
        phone: { type: "string" },
        age: {
            type: "number",
            min: 18
        }
    };

    let check = v.compile(constraints);

    let testObj = obj;

    console.time('t')
    for (let i = 0; i < 100; i++) {
        let res = check(testObj);
    }
    console.timeEnd('t')
}
testFastest();

function testSelf() {
    let test = Validator.createOnErrorBreakValidator();
    const obj = {
        name: "John Doe",
        email: "john.doe@company.space",
        firstName: "John",
        phone: null,
        age: 33
    };

    /*
    let a = [];
    let nameRules = name => [
        () => name.is.aString(),
        () => name.prop('length').is.inRange(4, 25)
    ];
    let ageRules = age => [
        () => age.is.anInteger(),
        () => age.is.greaterThan(18)
    ]
    let objRules = obj => [
        () => obj.prop('name').fulfillAllOf(nameRules),
        () => obj.prop('email').does.match(/\w+@\w+\.\w{1,4}/),
        () => obj.prop('firstName').is.aString(),
        () => obj.prop('phone').is.aString(),
        () => obj.prop('age').fulfillAllOf(ageRules)
    ]*/

    console.time('t')


    for (let i = 0; i < 100; i++) {
        //test(obj).fulfillAllOf(objRules);
        /*test(obj).fulfillAllOf(obj => [
            () => obj.is.anObject(),
            () => obj.isNot.nil(),
        ])*/
        test(obj).fulfillAllOf(obj => [
            () => obj.prop('name').fulfillAllOf(name => [
                () => name.is.aString(),
                () => name.prop('length').is.inRange(4, 25)
            ]),
            () => obj.prop('email').is.aString(),
            () => obj.prop('firstName').is.aString(),
            () => obj.prop('phone').is.aString(),
            () => obj.prop('age').fulfillAllOf(age => [
                () => age.is.anInteger(),
                () => age.is.greaterThan(18)
            ])
        ])
    }
    console.timeEnd('t')
    console.log(test.result.getAllErrors())
}

testSelf()
