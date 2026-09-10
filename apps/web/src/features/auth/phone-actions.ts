'use server';

import type { AuthSession, PhoneVerificationStartResponse } from '@dealers-drive/contracts';
import { IndianMobile, PhoneVerificationInput } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/**
 * The two server actions behind the OTP step (**R39**).
 *
 * The Firebase round trip itself happens in the browser — reCAPTCHA and
 * `signInWithPhoneNumber` need a `window` — and everything either side of it
 * happens here. That split is deliberate: the browser proves the handset, and
 * the *server* decides what that proof is worth. A client that skipped these
 * calls would have a Firebase session and no verified dealership, which is
 * exactly the right failure.
 *
 * The session cookie is host-only and forwarded by `apiSend`; the Firebase ID
 * token is not stored anywhere. It is used once, in the request below, and the
 * only thing that survives is a boolean on the user record.
 */
export interface PhoneState {
  /** `+919840012345`, once the server has normalised what was typed. */
  phone?: string;
  phoneDisplay?: string;
  verified?: boolean;
  error?: string;
  /** Renders under the box the dealer typed into, rather than as a banner. */
  fieldError?: string;
}

/**
 * Step one: normalise the number and check it is free, before an SMS is sent.
 *
 * Both halves matter. The normalisation means the browser hands Firebase
 * exactly what our records will hold — two implementations of that conversion
 * is a bug nobody can see, because the code arrives, the dealer enters it, and
 * the number stored is not the number that was texted. The check means a number
 * another dealership already holds is refused *before* it costs a message.
 */
export async function startPhoneVerificationAction(phone: string): Promise<PhoneState> {
  const parsed = IndianMobile.safeParse(phone);
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0]?.message ?? 'Enter a 10-digit mobile number.' };
  }

  try {
    const started = await apiSend<PhoneVerificationStartResponse>('POST', '/v1/auth/phone/start', {
      phone: parsed.data,
    });
    return { phone: started.phone, phoneDisplay: started.phoneDisplay };
  } catch (error) {
    return failure(error, 'That number could not be checked. Try again.');
  }
}

/**
 * Step two: hand the ID token to the API and let it decide.
 *
 * `revalidatePath` because the wizard is server-rendered from `/v1/auth/me` —
 * without it the dealer verifies successfully and the page they are looking at
 * still says they have not.
 */
export async function verifyPhoneAction(idToken: string): Promise<PhoneState> {
  const parsed = PhoneVerificationInput.safeParse({ idToken });
  if (!parsed.success) {
    return { error: 'The verification did not complete. Send a new code and try again.' };
  }

  try {
    const session = await apiSend<AuthSession>('POST', '/v1/auth/phone/verify', parsed.data);
    revalidatePath('/dealer/onboarding');
    return {
      verified: true,
      phone: session.user.phone,
      phoneDisplay: session.user.phoneDisplay,
    };
  } catch (error) {
    return failure(error, 'That code could not be checked. Try again.');
  }
}

/**
 * The API's own sentence, when it has one.
 *
 * Every refusal this endpoint produces is already written for a dealer to read
 * — "That mobile number is already registered to another dealership", "That
 * code has expired. Send a new one and try again" — so restating them here
 * would be a second copy to keep in step with the first. A 5xx is the
 * exception: `userMessage` drops the detail on those, because an internal
 * message is not a sentence anybody should be shown.
 */
function failure(error: unknown, fallback: string): PhoneState {
  if (!(error instanceof ApiError)) {
    return { error: 'The API is unavailable. Try again shortly.' };
  }

  const fieldError = error.fieldErrors().phone;
  return fieldError
    ? { fieldError, error: error.userMessage(fallback) }
    : { error: error.userMessage(fallback) };
}
