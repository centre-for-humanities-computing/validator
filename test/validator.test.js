// noinspection JSUnresolvedReference,DuplicatedCode

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Validator } from "../src/validator.js";


let person = {
    name: "John",
    age: 23
};

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

describe('#prop()', () => {
    it('returns a Validator', () => {
        expect(throwValidator(person).prop('name')).instanceOf(Validator);
    });

    it('returns a new Validator instance', () => {
        let validator = throwValidator(person);
        expect(validator.prop('name')).not.toBe(validator);
    });

    describe('mode === ON_ERROR_NEXT_PATH', () => {
        it('returns a short-circuit Validator when path has error', () => {
            // silence warning
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            let validator = nextPathValidator(person);
            validator.prop('name').is.empty('name must be empty'); // something that errors
            validator = nextPathValidator(person);
            expect(validator.prop('name').is).toBe(Validator._shortCircuitFulfilledValidatorContext);
        });

        it('console.warn() when trying to get a prop() of a path which have previously errored', () => {
            // silence warning and intercept
            let warnMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            let validator = nextPathValidator(person);
            validator.prop('name').is.empty('name must be empty'); // something that errors
            validator = nextPathValidator(person); // get a new root validator, with the same error context
            validator.prop('name');
            expect(warnMock.mock.lastCall).to.match(/The property path "name" of "name"/);
        });
    });
});

// TODO test all methods