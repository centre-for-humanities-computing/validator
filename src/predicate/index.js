import { stringTrim } from "../transform/index.js";
import { Validator } from "../validator.js";

/**
 *
 * @param {Validator} str
 */
export function stringTrimmedNotEmpty(str) {
    return str.fulfillAllOf(str => [
        str.is.aString(),
        str.transform(stringTrim).isNot.empty()
    ]);
}


let test = Validator.createOnErrorThrowValidator();
test('test', 'name').fulfillAllOf(str => [
    stringTrimmedNotEmpty,

], '${PATH} with ${VALUE} must be a non empty string');
