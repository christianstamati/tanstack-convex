import { defineErrors } from "@cs-stack/convex-errors";

/**
 * Every error the user can see, with its default message. Throw one with
 * `errors.create(code, params)`. The web app imports this file too, so keep server code out.
 */
export const errors = defineErrors({
  not_found: (p: { what: "note" }) => `That ${p.what} doesn't exist anymore.`,
  invalid_length: (p: { what: "note"; min: number; max: number }) =>
    `A ${p.what} must be ${p.min} to ${p.max} characters.`,
});
