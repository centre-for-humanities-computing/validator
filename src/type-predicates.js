// performance optimization (and small changes) instead of using the ones from lodash

function isBoolean(value) {
    return value === true || value === false;
}

function isFunction(func) {
    return typeof func === 'function';
}

function isNil(value) {
    return value === null || value === undefined;
}

function isMap(value) {
    return value instanceof Map;
}

function isNumber(value) {
    return typeof value === 'number';
}

function isObject(value) {
    return typeof value === 'object' && value !== null;
}

function isSet(value) {
    return value instanceof Set;
}

function isString(value) {
    return typeof value === 'string';
}


module.exports = {
    isBoolean,
    isFunction,
    isMap,
    isNil,
    isNumber,
    isObject,
    isSet,
    isString,
};