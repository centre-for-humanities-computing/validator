import { stringTrim } from "../transform/index.js";

/**
 * A predicate function to check multiple conditions for strings: type and non-emptiness.
 * @param {Validator} str - The `Validator` instance containing the context to check.
 * @returns {boolean} - `true` if the string passed the tests, otherwise `false`.
 */
export function stringTrimmedNotEmpty(str) {
    return str.fulfillAllOf(str => [
        str.is.aString(),
        str.transform(stringTrim).isNot.empty()
    ]);
}

/**
 * A predicate function to check if a number is an integer and > 0.
 * @param int - The `Validator` instance containing the context to check.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function integerGreaterThanZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThan(0)
    ]);
}

/**
 * A predicate function to check if a number is an integer and >= 0.
 * @param int - The `Validator` instance containing the context to check.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function integerGreaterThanOrEqualZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThanOrEqualTo(0)
    ]);
}

/**
 * A predicate function to check if a number is > 0.
 * @param num - The `Validator` instance containing the context to check.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function numberGreaterThanZero(num) {
    return num.fulfillAllOf(num => [
        num.is.aNumber(),
        num.is.greaterThan(0)
    ]);
}

/**
 * A predicate function to check if a number is >= 0.
 * @param num - The `Validator` instance containing the context to check.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function numberGreaterThanOrEqualZero(num) {
    return num.fulfillAllOf(num => [
        num.is.aNumber(),
        num.is.greaterThanOrEqualTo(0)
    ]);
}