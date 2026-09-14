/**
 * The sentences more than one module says.
 *
 * A message a person reads is part of the product's voice, and two modules
 * writing it out separately is how "That upload does not exist." becomes "That
 * upload doesn't exist." on one screen and not the other. Messages that only one
 * module ever says stay in that module.
 */

/** A field refusal: the value is taken, whichever uniqueness rule caught it. */
export const ALREADY_REGISTERED = 'Already registered.';

export const UPLOAD_NOT_FOUND = 'That upload does not exist.';
export const UPLOAD_INCOMPLETE = 'The upload did not complete. Try again.';
export const DOCUMENT_NOT_FOUND = 'That document does not exist.';

/** What a failed `validate()` says before the per-field errors underneath it. */
export const MALFORMED_REQUEST = 'The request did not match the expected shape.';
