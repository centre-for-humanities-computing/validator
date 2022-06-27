const { Validator } = require('../src/validator');

let obj = {
    materials: [],
    manufacturingProcessDescription: 'dfdf',
    society: null, // ENTEN society ELLER customSociety skal have en værdi (object)
    customSociety: 'dfd', // (string)
    scale: null,
    learn: null,
    userGender: null,
    userAge: null,
    manufacturerAge: null,
    manufacturerGender: null,
    manufacturerKin: null,
    risk: null,
    imageCaption: 'sds',
    continent: 'sds', // required (string)
    composite: null,
    social: null,
    materialDetail: '',
    objectName: 'dfdf', // required (string)
    geoPoint: { lat: 10, long: 20 }, // Skal enten være null eller have BÅDE lat & long (lat: -90 til 90 float og long: -180 til 180 float)
    notes: '',
    recordType: null,
    subsistence: null,
    citationDetails: 'dsdsd', // required (string)
    contributorEmail: '', // ikke required, men hvis den udfyldes skal den være en valid email (string)
    toolSize: 'dssd',
    observationYears: 'sdsd',
    objectType: null,
    pathways: [],
    mechanisms: [],
    contextsOfUse: [], // ENTEN contextsOfUse (length > 0) ELLER customContextsOfUse skal have en værdi ([]object)
    customContextsOfUse: 'sdsd', // (string)
    report: 'sds', // required (string)
    // Permissions
    ethicallyCollected: true, // required true (bool)
    accuracyIntegrity: true, // required true (bool)
    authorApproved: true, // required true (bool)
    noCopyrightInfringement: true, // required true (bool)
    imageOwnership: false, // ENTEN imageOwnership ELLER imagePermission skal være true (bool)
    imagePermission: true, // (bool)
    permissionDetails: 'sds',
};

function test() {
    let test = Validator.createOnErrorThrowValidator();

    const notEmptyString = str => str.fulfillAllOf(str => [
        str.is.aString(),
        str.transform(str => str.trim()).isNot.empty()
    ]);

    const booleanAndTrue = boolean => boolean.fulfillAllOf(boolean => [
        boolean.is.aBoolean(),
        boolean.is.identicalTo(true)
    ]);

    test(obj).fulfillAllOf(o => [
        o.prop('materials').is.anArray('${PATH} must be an array'),
        o.prop('manufacturingProcessDescription').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.fulfillOneOf(o => [
            o.prop('society').isNot.nil(),
            o.prop('customSociety').isNot.nil(),
        ], 'One of "society" or "customSociety" must be filled out'),
        o.prop('society').optional.is.anObject('${PATH} must be an object'),
        o.prop('customSociety').optional.fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('continent').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('materialDetail').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('objectName').is.fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('geoPoint').optional.fulfillAllOf(geoPoint => [
            geoPoint.is.anObject('${PATH} must be an object'),
            geoPoint.prop('lat').fulfillAllOf(lat => [
                lat.is.aNumber(),
                lat.is.inRange(-90, 90)
            ], '${PATH} must be a number in the range [-90 - 90]')
        ]),
        o.prop('citationDetails').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('contributorEmail').fulfillOneOf(email => [
            email.optional.does.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/),
            email.is.empty()
        ], '${PATH} must be a valid email or empty'),
        o.prop('toolSize').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('observationYears').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.fulfillOneOf(o => [
            o.prop('contextsOfUse').fulfillAllOf(contextsOfUse => [
                contextsOfUse.is.anArray(),
                contextsOfUse.prop('length').is.greaterThan(0),
                contextsOfUse.each(elem => elem.is.anObject())
            ]),
            o.prop('customContextsOfUse').fulfill(notEmptyString)
        ], '"contextsOfUse" must have a length > 0 and contain objects or "customContextsOfUse" must be filled out'),
        o.prop('report').fulfill(notEmptyString, '${PATH} must a string and cannot be empty'),
        o.prop('ethicallyCollected').fulfill(booleanAndTrue, '${PATH} must be true'),
        o.prop('accuracyIntegrity').fulfill(booleanAndTrue, '${PATH} must be true'),
        o.prop('authorApproved').fulfill(booleanAndTrue, '${PATH} must be true'),
        o.prop('noCopyrightInfringement').fulfill(booleanAndTrue, '${PATH} must be true'),
        o.fulfillOneOf(o => [
            o.prop('imageOwnership').fulfill(booleanAndTrue),
            o.prop('imagePermission').fulfill(booleanAndTrue)
        ], 'One of "imageOwnership" or "imagePermission" must be true'),
        o.prop('permissionDetails').fulfill(notEmptyString, '${PATH} must a string and cannot be empty')
    ]);

    console.log(test.result.getAllErrors())
}

test();