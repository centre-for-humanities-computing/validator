import { Validator } from '../../src/index.js';

function run() {
    try {
        Validator.debug(true);
        let t = Validator.createOnErrorThrowValidator();

        t(2).doesNot.aString();
        let o = {
            t: [
                { c: 2 },
                { a: 2 }
            ]
        };

        // test noget mere med nestede each og fulfilOneOff
        t(o).prop('t').each((t => t.fulfillOneOf(t => [
            t.prop('a').isNot.nil(),
            t.prop('b').isNot.nil(),
        ])), 'fail');


        let isEmptyStringRule = (arg) => arg.fulfillAllOf((arg) => [false,
            /*arg.is.aString(),
            arg.fulfill(arg => arg.value.trim() === '') // is empty*/
        ]);

        let typeValueValidator = (date) => date.optional.fulfillOneOf((date) => [
                //date.fulfill(d => console.log(d.is.anArray())),
                date.is.anInteger() // da denne er true short-circuits fulfillOneOf og ovenstående bliver kaldt med et objekt der altid er true,

            ],
            '[min, max] filter value for field ${0} must be a date in one of the formats ' +
            "[yyyy-MM-dd, yyyy-MM-dd HH:mm:ss, ISO_8601_COMPLIANT, UNIX_TIMESTAMP]");
        t([23, 24], 'basePath').each(typeValueValidator);


        let pers = {
            name: 'peer',
            age: 19,
            address: {
                zip: '8000'
            }
        };
        let zipCodes = ['8000', '9000'];
        let ruleSet = Validator.createOnErrorThrowRuleSet('Person object error:');
        ruleSet.addRule('', person => person.fulfillAllOf((person) => [
            person.is.anObject('person must be an object')
        ]));
        ruleSet.addRule('name', name => name.fulfillAllOf((name) => [
            name.is.aString('${PATH} must be a string'),
            name.isNot.empty('name cannot be empty')
        ]));
        ruleSet.addRule('age', age => age.fulfillAllOf((age) => [
            age.is.anInteger('${PATH} must be an integer'),
            age.is.inRange(18, 99, 'age must be in range ${0} - ${1}', [18, 99])
        ]));
        ruleSet.addRule('address.zip', (zip, zipCodes) => zip.is.in(zipCodes, '${PATH} in not a valid zip-code'));

        ruleSet.validate(pers, undefined, zipCodes);
        /*console.time('te')
        for (let i = 0; i < 100_000; i++) {

            ruleSet.isValid(pers);
        }
        console.timeEnd('te')
        console.log(ruleSet.validate(pers).getError('name'))*/
        //console.log(ruleSet.validate(pers, '').getAllErrors())

        //ruleSet.isValid(pers);
        //console.log(ruleSet.validate(pers, 'name').toString())


        let test = Validator.create('test error:', Validator.mode.ON_ERROR_NEXT_PATH);
        /*test(3).is.aString()
        test.result.isValid();*/


        /* let name = "";
         test(name).isNot.nil('Name cannot be null or undefined');
         test(name).is.aString('Name must be a string');
         test(name).optional.fulfillAllOf(name => [
                 name.is.aString(),
                 name.does.match(/\w+/)
             ],
             'Name must have length > 1 and only contain letters'
         );

         test(name).fulfillAllOf(name => [
             name.is.aString(),
             name.is.aNumber('must be a number'),
             name.is.in(['John', 'Michael'])
         ], 'The name must be a string and one of "John" or "Michael"');

         let numbers = [1, 2, 3, 4, 5, 6, 7, 8];
         //test(numbers).each((element) => element.is.aNumber(), 'Must be a number but was "${VALUE}"');


         test(numbers).optional.each(number => number.fulfillAllOf(number => [
             number.is.aNumber('The element must be a number but was "${VALUE}"'),
             number.is.inRange(1, 10, 'The element must be in the range [1, 10] but was "${VALUE}"'),
         ]));

     */

        /*
           console.time("t");
          let person = { name: "", age: "54" };
           for (let i = 0; i < 100000; i++) {

           test(person, 'person').fulfillAllOf(person => [
               person.is.anObject('person must be an object'),
               person.prop('name').fulfillAllOf(name => [
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


        let person = { name: "Eric", age: 49 };
        test(person).fulfillAllOf(person => [
            person.is.anObject('person must be an object'),
            person.conditionally(person => person.value.name === 'Eric').fulfill(() =>
                person.prop('age').is.greaterThan(50, 'Age must be greater that 50 for persons named Eric')
            )
        ]);
        //console.log(test.result.getAllErrors());

    } catch (e) {
        console.error(e);
    }
}

// run();

function testPerson() {

    let person = { name: "John", age: 54, ssn: undefined };

    let test = Validator.createOnErrorNextPathValidator('Person validation error');


    /*test(person).fulfillAllOf(person => [
        person.is.anObject('person must be an object'),
        person.prop('name').fulfillAllOf(name => [
            name.is.aString('${PATH} must be a string'),
            name.transform((name) => name.trim()).isNot.empty('${PATH} cannot be empty')
        ]),
        person.prop('age').is.aNumber('${PATH} must be a number'),
        person.prop('ssn').optional.fulfillAllOf(ssn => [
            ssn.is.aString('${PATH} must be a string or undefined'),
            ssn.does.match(/^\d{6}-?\d{4}$/, '${PATH} must match xxxxxx-xxxx')
        ])
    ]);*/


    test(person).fulfillAllOf(person => [
        person.is.anObject(),
        person.fulfillAllOf(person => [
            person.is.anObject(),
        ])
    ], "bang");

    //problemet er måske at vi i conditionally laver en noopValidationResult object??
    test(person).fulfillAllOf(person => [
        person.conditionally(person => person.is.equalTo(person.value)).prop('name').fulfillAllOf(name => [
            name.is.aString("${CURRENT_PATH} must be a int"),
        ])
    ]);

    test(person).fulfillAllOf(person => [
        person.conditionally(() => true).prop('name').fulfillAllOf(name => [
            name.is.aString("name must be a sintr"),
            name.is.aNumber('Name must be a number')
        ])
    ]);

    let result = Validator.validationResult(test);
    console.log(result.isValid());
    console.log(result.getAllErrors());
}

testPerson();

function testMessageArgs() {
    let t = Validator.createOnErrorThrowValidator();
    t(3).is.identicalTo(2, 'no not ${0} ${1}', [[9, 2], 2]);
}

//testMessageArgs();


