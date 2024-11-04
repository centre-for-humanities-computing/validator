import { stringTrim } from "../transform/index.js";

/**
 * Tests if the value is a string and is not empty after trimming the string.
 * @param {Validator} str - The `Validator` instance containing the value to test.
 * @returns {boolean} - `true` if the string passed the tests, otherwise `false`.
 */
export function stringTrimmedNotEmpty(str) {
    return str.fulfillAllOf(str => [
        str.is.aString(),
        str.transform(stringTrim).isNot.empty()
    ]);
}

/**
 * Tests if the value is an integer and > 0.
 * @param {Validator} int - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function integerGreaterThanZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThan(0)
    ]);
}

/**
 * Tests if the value is an integer and >= 0.
 * @param {Validator} int - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function integerGreaterThanOrEqualZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThanOrEqualTo(0)
    ]);
}

/**
 * Tests if the value is a safe integer and > 0.
 * @param {Validator} int - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function safeIntegerGreaterThanZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThan(0)
    ]);
}

/**
 * Tests if the value is a safe integer and >= 0.
 * @param {Validator} int - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function safeIntegerGreaterThanOrEqualZero(int) {
    return int.fulfillAllOf(int => [
        int.is.anInteger(),
        int.is.greaterThanOrEqualTo(0)
    ]);
}

/**
 * Tests if the value is a number and > 0.
 * @param {Validator} num - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function numberGreaterThanZero(num) {
    return num.fulfillAllOf(num => [
        num.is.aNumber(),
        num.is.greaterThan(0)
    ]);
}

/**
 * Tests if the value is a number and >= 0.
 * @param {Validator} num - The `Validator` instance containing the value to test.
 * @return {boolean} - `true` if the number passed the tests, otherwise `false`.
 */
export function numberGreaterThanOrEqualZero(num) {
    return num.fulfillAllOf(num => [
        num.is.aNumber(),
        num.is.greaterThanOrEqualTo(0)
    ]);
}