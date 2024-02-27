// performance optimization (and small changes) instead of using the ones from lodash

export function isBoolean(value) {
    return value === true || value === false;
}

export function isFunction(func) {
    return typeof func === 'function';
}

export function isNil(value) {
    return value === null || value === undefined;
}

export function isMap(value) {
    return value instanceof Map;
}

export function isNumber(value) {
    return typeof value === 'number';
}

export function isObject(value) {
    return typeof value === 'object' && value !== null;
}

export function isSet(value) {
    return value instanceof Set;
}

export function isString(value) {
    return typeof value === 'string';
}