// noinspection JSUnresolvedReference,DuplicatedCode

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Validator } from "../src/index.js";

let throwValidator;
let breakValidator;
let nextPathValidator;

beforeEach(() => {
    throwValidator = Validator.createOnErrorThrowValidator();
    breakValidator = Validator.createOnErrorBreakValidator();
    nextPathValidator = Validator.createOnErrorNextPathValidator();
});

afterEach(() => {
    vi.resetAllMocks();
});

describe('#anArray()', () => {
    it('returns true when an array is passed in', () => {
        expect(throwValidator([]).is.anArray()).toBe(true);
    });

    it('returns false when something else than an array is passed in', () => {
        expect(throwValidator(null).is.anArray()).toBe(false);
        expect(throwValidator(undefined).is.anArray()).toBe(false);
        expect(throwValidator('').is.anArray()).toBe(false);
    });
});


// TODO test all predicate function here...
// TODO test that it throws Validation error when in throw mode
// TODO test that it collects errors when in all three modes and errors are accessible from Validator.validationResult(testFunction)