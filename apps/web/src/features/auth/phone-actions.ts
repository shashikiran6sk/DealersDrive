'use server';

import type { AuthSession, PhoneVerificationStartResponse } from '@dealers-drive/contracts';
import { IndianMobile, PhoneVerificationInput } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/** Server actions forward the existing session; OTP credentials remain on the API. */
export interface PhoneState {
  /** `+919840012345`, once the server has normalised what was typed. */
  phone?: string;
  phoneDisplay?: string;
  verified?: boolean;
  challengeId?: string;
  resendAfterSeconds?: number;
  error?: string;
  /** Renders under the box the dealer typed into, rather than as a banner. */
  fieldError?: string;
}

/** Start a user-bound challenge and send the code through the API. */
export async function startPhoneVerificationAction(phone: string): Promise<PhoneState> {
  const parsed = IndianMobile.safeParse(phone);
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0]?.message ?? 'Enter a 10-digit mobile number.' };
  }

  try {
    const started = await apiSend<PhoneVerificationStartResponse>('POST', '/v1/auth/phone/start', {
      phone: parsed.data,
    });
    return {
      phone: started.phone,
      phoneDisplay: started.phoneDisplay,
      challengeId: started.challengeId,
      resendAfterSeconds: started.resendAfterSeconds,
    };
  } catch (error) {
    return failure(error, 'That code could not be sent. Try again.');
  }
}

/**
 * Step two: verify the code against the session-bound challenge.
 *
 * `revalidatePath` because the wizard is server-rendered from `/v1/auth/me` —
 * without it the dealer verifies successfully and the page they are looking at
 * still says they have not.
 */
export async function verifyPhoneAction(challengeId: string, code: string): Promise<PhoneState> {
  const parsed = PhoneVerificationInput.safeParse({ challengeId, code });
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
