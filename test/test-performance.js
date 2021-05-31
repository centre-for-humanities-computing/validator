const { Validator } = require('../src/validator');
const _ = require('lodash');

/*
* examples with different libraries and stats here: https://github.com/icebob/validator-benchmark/blob/master/suites/simple.js
* We perform a little slower than Joi, but still ok
* */

const iterations = 100000;

function testJoi() {

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
    for (let i = 0; i < iterations; i++) {

        constraints.validate(obj);
    }
    console.timeEnd('t')

}

testJoi();

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
    for (let i = 0; i < iterations; i++) {
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
        phone: "123-4567",
        age: 33
    };

    console.time('t')

    for (let i = 0; i < iterations; i++) {
        test(obj).fulfillAllOf(obj => [
            () => obj.prop('name').fulfillAllOf(name => [
                () => name.is.aString('${PATH} must be a string'),
                () => name.prop('length').is.inRange(4, 25, '${PATH} must be >= 4 4 and <= 25')
            ]),
            () => obj.prop('email').is.aString('${PATH} must be a string'),
            () => obj.prop('firstName').is.aString('${PATH} must be a string'),
            () => obj.prop('phone').is.aString('${PATH} must be a string'),
            () => obj.prop('age').fulfillAllOf(age => [
                () => age.is.anInteger('${PATH} must be an integer'),
                () => age.is.greaterThanOrEqualTo(18, '${PATH} must be >= 18')
            ])
        ])
    }
    console.timeEnd('t')
    console.log(test.result.getAllErrors())
}

testSelf()
