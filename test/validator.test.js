// noinspection JSUnresolvedReference,DuplicatedCode

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidatorContext } from "../src/validator-context.js";
import { SHORT_CIRCUIT_FULFILLED_VALIDATOR_CONTEXT, Validator } from "../src/validator.js";

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
            validator.fulfillAllOf(person => [
                person.prop('name').is.empty('name must be empty'), // something that errors
                person.prop('age').fulfill(() => {
                    expect(person.prop('name').is).toBe(SHORT_CIRCUIT_FULFILLED_VALIDATOR_CONTEXT);
                })
            ]);
        });

        it('returns an actual Validator instance when in a new context even if path has error', () => {
            let validator = nextPathValidator(person);
            validator.prop('name').is.empty('name must be empty'); // something that errors
            validator = nextPathValidator(person); // create a new context
            expect(validator.prop('name').is).toBeInstanceOf(ValidatorContext);
        });

        it('console.warn() when trying to get a prop() of a path which have previously errored', () => {
            // silence warning and intercept
            let warnMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            let validator = nextPathValidator(person);
            validator.fulfillAllOf(person => [
                person.prop('name').is.empty('name must be empty'), // something that errors
                person.prop('age').fulfill(() => {
                    person.prop('name'); // make it print the warning
                    expect(warnMock.mock.lastCall).to.match(/The property path "name" of "name"/);
                })
            ]);
        });
    });
});

// TODO test all methods