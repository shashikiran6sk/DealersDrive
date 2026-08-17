import type { RevealContactResponse } from '@dealers-drive/contracts';

/**
 * The values shared between the enquiry Server Actions and the components that
 * call them. They live outside `actions.ts` because a `'use server'` module may
 * only export async functions.
 */

/** Where the success screen reads its one-shot payload from. */
export const ENQUIRY_RESULT_COOKIE = 'dd.enquiry-result';

export interface EnquiryFormState {
  status: 'idle' | 'error';
  /** Keyed by field name, straight onto the inputs (§2.3 error state). */
  fieldErrors: Record<string, string>;
  message?: string;
}

export const EMPTY_ENQUIRY_STATE: EnquiryFormState = { status: 'idle', fieldErrors: {} };

export type RevealContactResult =
  | { status: 'revealed'; contact: RevealContactResponse }
  | { status: 'captcha'; message: string }
  | { status: 'error'; message: string };
