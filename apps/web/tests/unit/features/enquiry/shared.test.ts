import { describe, expect, it } from 'vitest';

import {
  EMPTY_ENQUIRY_STATE,
  ENQUIRY_RESULT_COOKIE,
} from '../../../../src/features/enquiry/shared.js';

/**
 * The values shared between the enquiry Server Actions and the components that
 * call them. They live outside `actions.ts` because a `'use server'` module may
 * only export async functions — so this file exists to make that constraint
 * survivable, and the tests here mostly guard against the constants drifting
 * apart from the two places that read them.
 */

describe('ENQUIRY_RESULT_COOKIE', () => {
  /**
   * The name is the contract between the action that sets the cookie and the
   * success page that reads it. If either side hard-coded a string instead of
   * importing this, a rename would leave a buyer on a success page with no
   * reference number to quote.
   */
  it('is namespaced, so it cannot collide with another cookie', () => {
    expect(ENQUIRY_RESULT_COOKIE).toBe('dd.enquiry-result');
    expect(ENQUIRY_RESULT_COOKIE.startsWith('dd.')).toBe(true);
  });

  it('is a legal cookie name', () => {
    expect(ENQUIRY_RESULT_COOKIE).toMatch(/^[\w.-]+$/);
  });
});

describe('EMPTY_ENQUIRY_STATE', () => {
  /** The initial state `useActionState` is seeded with. */
  it('starts idle with no errors', () => {
    expect(EMPTY_ENQUIRY_STATE).toEqual({ status: 'idle', fieldErrors: {} });
  });

  /**
   * `fieldErrors` is always an object, never undefined, so the form can index
   * into it without a guard on every input.
   */
  it('carries an object rather than an absent errors map', () => {
    expect(EMPTY_ENQUIRY_STATE.fieldErrors).toEqual({});
    expect(typeof EMPTY_ENQUIRY_STATE.fieldErrors).toBe('object');
  });

  it('carries no message, so nothing renders before a submission', () => {
    expect(EMPTY_ENQUIRY_STATE.message).toBeUndefined();
  });
});
