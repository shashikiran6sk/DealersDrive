'use server';

import { VerifyPhoneInput, type VerifyPhoneResponse } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/**
 * The server half of the phone check (**R39**).
 *
 * A Server Action rather than a browser `fetch`, for the reason every write in
 * this app is one: the `dd_session` cookie is HttpOnly and is forwarded by
 * `lib/api.ts` on the server. No token is handed to client JavaScript, and the
 * API's base URL never has to become a `NEXT_PUBLIC_*` variable (rule 9,
 * ARCHITECTURE §15.3).
 *
 * The access token does cross this boundary, in the other direction — the
 * widget minted it in the browser and it has to reach the API somehow. That is
 * safe precisely because it proves nothing on its own: only MSG91, asked with
 * the server-only auth key, can say what it is worth.
 */
export interface PhoneVerificationState {
  verified?: boolean;
  phone?: string;
  phoneDisplay?: string;
  /** The one line the panel shows when it did not work. */
  error?: string;
}

export async function verifyPhoneAction(
  phone: string,
  accessToken: string,
): Promise<PhoneVerificationState> {
  const parsed = VerifyPhoneInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That number could not be verified.' };
  }

  let result: VerifyPhoneResponse;
  try {
    result = await apiSend<VerifyPhoneResponse>('POST', '/v1/auth/phone/verify', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.userMessage('That code could not be verified.') };
    }
    return { error: 'The API is unavailable. Try again shortly.' };
  }

  /*
   * The onboarding page reads `phoneVerified` off `GET /v1/auth/me` to decide
   * what step 1 shows. Without this, a dealer who verifies and then reloads —
   * or who presses Back from step 3 — is asked for a code they have already
   * given, because the cached render still says the number was never proved.
   */
  revalidatePath('/dealer/onboarding');

  return { verified: true, phone: result.phone, phoneDisplay: result.phoneDisplay };
}
