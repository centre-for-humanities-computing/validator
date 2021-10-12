const { Validator } = require('../src/validator');
const _ = require('lodash');
const nameGenerator = require('random-name');

/*
* examples with different libraries and stats here: https://github.com/icebob/validator-benchmark/blob/master/suites/simple.js
* We perform a little slower than Joi, but still ok
* */

const iterations = 100000;

function getTestObj() {
    let first = nameGenerator.first();
    let last = nameGenerator.last();
    let full = `${first} ${last}`;
    return {
        name: full,
        email: "john.doe@company.space",
        firstName: first,
        phone: "" + Math.round(Math.random() * 1000000),
        age: 18 + Math.round(Math.random() * 80)
    };
}

let testObjects = new Array(iterations);
for (let i = 0; i < iterations; i++) {
    testObjects[i] = getTestObj();
}

function testJoi() {
    const Joi = require('joi');

    const constraints = Joi.object().keys({
        name: Joi.string().min(4).max(25).required(),
        email: Joi.string().required(),
        firstName: Joi.required(),
        phone: Joi.required(),
        age: Joi.number().integer().min(18).required()
    });


    console.time('joi\t\t');
    for (let i = 0; i < iterations; i++) {
        let obj = testObjects[i];
        constraints.validate(obj);
    }
    console.timeEnd('joi\t\t')

}



function testFastest() {
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

    console.time('fastest\t\t')
    for (let i = 0; i < iterations; i++) {
        let obj = testObjects[i];
        let res = check(obj);
    }
    console.timeEnd('fastest\t\t')
}

function testSelf() {
    let test = Validator.createOnErrorNextPathValidator();

    let ruleSet = Validator.createOnErrorNextPathRuleSet();
    ruleSet.addRule('name', (name) => name.fulfillAllOf(name => [
        name.is.aString('${PATH} must be a string'),
        name.prop('length').is.inRange(4, 25, '${PATH} must be >= 4 and <= 25, but was ${VALUE}')
    ]));
    ruleSet.addRule('email', (email) => email.is.aString('${PATH} must be a string'));
    ruleSet.addRule('firstName', (firstName) => firstName.is.aString('${PATH} must be a string'));
    ruleSet.addRule('phone', (phone) => phone.is.aString('${PATH} must be a string'));
    ruleSet.addRule('age', (age) => age.fulfillAllOf(age => [
        age.is.anInteger('${PATH} must be an integer'),
        age.is.greaterThanOrEqualTo(18, '${PATH} must be >= 18, but was ${VALUE}')
    ]));


    console.time('self\t\t')

    for (let i = 0; i < iterations; i++) {
        let obj = testObjects[i];
        ruleSet.validate(obj);
        /*test(obj).fulfillAllOf(obj => [
            obj.prop('name').fulfillAllOf(name => [
                name.is.aString('${PATH} must be a string'),
                name.prop('length').is.inRange(4, 25, '${PATH} must be >= 4 and <= 25, but was ${VALUE}')
            ]),
            obj.prop('email').is.aString('${PATH} must be a string'),
            obj.prop('firstName').is.aString('${PATH} must be a string'),
            obj.prop('phone').is.aString('${PATH} must be a string'),
            obj.prop('age').fulfillAllOf(age => [
                age.is.anInteger('${PATH} must be an integer'),
                age.is.greaterThanOrEqualTo(18, '${PATH} must be >= 18, but was ${VALUE}')
            ])
        ]);*/
    }
    console.timeEnd('self\t\t')
    console.log(test.result.getAllErrors())
}

testJoi();
testFastest();
testSelf();