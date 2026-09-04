'use server';

import {
  AdminLoginInput,
  OnboardingInput,
  type AdminSessionResponse,
  type AuthSession,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiSend, apiSignIn, SESSION_COOKIE } from '@/lib/api';

/**
 * The three writes that change who you are.
 *
 * All three are Server Actions rather than browser fetches, for one reason:
 * the session cookie has to be set and cleared server-side (ARCHITECTURE
 * §15.2). No token is ever handed to client JavaScript — there is nothing in
 * `localStorage`, nothing in a React state atom, and nothing a script on the
 * page could read.
 */
export interface ActionState {
  message?: string;
  errors?: Record<string, string>;
  /** What was submitted, so a rejected form re-renders with it rather than blank. */
  values?: Record<string, string>;
  saved?: boolean;
}

/**
 * Admin sign-in. The API is the only thing that verifies the password; this
 * relays the session it issues onto the browser.
 */
export async function adminLoginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = AdminLoginInput.safeParse({
    email: text(formData, 'email'),
    password: text(formData, 'password'),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error.issues) };
  }

  try {
    const { session } = await apiSignIn<AdminSessionResponse>('/v1/auth/admin/login', parsed.data);

    if (!session) return { message: 'Sign-in did not return a session. Try again.' };
    await setSession(session.value, session.expires);
  } catch (error) {
    if (error instanceof ApiError) {
      // The API answers identically for an unknown account and a wrong
      // password; repeating its message keeps it that way here.
      return { message: error.userMessage('That email and password do not match.') };
    }
    return { message: 'The admin API is unavailable. Try again shortly.' };
  }

  redirect('/admin');
}

/** Dealer onboarding — the step between a verified Google identity and a tenant. */
export async function onboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    [
      'fullName',
      'roleTitle',
      'phone',
      'brandName',
      'legalName',
      'addressLine',
      'citySlug',
      'pincode',
      'landline',
    ].map((field) => [field, text(formData, field)]),
  );

  const parsed = OnboardingInput.safeParse({
    fullName: text(formData, 'fullName').trim(),
    roleTitle: emptyToUndefined(text(formData, 'roleTitle')),
    phone: text(formData, 'phone').trim(),
    brandName: text(formData, 'brandName').trim(),
    legalName: text(formData, 'legalName').trim(),
    addressLine: text(formData, 'addressLine').trim(),
    citySlug: text(formData, 'citySlug'),
    pincode: text(formData, 'pincode').trim(),
    landline: emptyToUndefined(text(formData, 'landline')),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error.issues), values };
  }

  try {
    await apiSend<AuthSession>('POST', '/v1/auth/onboarding', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('That could not be saved.'),
        errors: error.fieldErrors(),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  redirect('/dealer/onboarding?step=2');
}

/**
 * Sign out, for either console.
 *
 * The API call is what matters: it revokes the `sessions` row, so the token
 * stops working everywhere rather than merely being forgotten by this browser.
 * Clearing the cookie afterwards is housekeeping, and is deliberately done even
 * if the revoke failed — a browser holding a cookie it believes in is worse
 * than one that has to sign in again.
 */
export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void> {
  const path = scope === 'admin' ? '/v1/auth/admin/logout' : '/v1/auth/logout';

  try {
    await apiSend<void>('POST', path);
  } catch {
    // Already expired, already revoked, API down — all end the same way.
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect(scope === 'admin' ? '/admin/login' : '/dealer/login');
}

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `saveBusinessIdsAction` and `submitForVerificationAction` sit here in the
 * baseline. The first parses `UpdateDealerInput` and writes `PATCH /v1/dealer`;
 * the second posts `POST /v1/dealer/submit` and reads `DealerSubmitResponse`.
 * Neither contract nor route exists yet, and both belong to the onboarding
 * wizard rather than to sign-in. They return with their own steps, along with
 * the two `describe` blocks in `actions.test.ts` that cover them.
 *
 * The first is **F041**, not F039 as this note originally said: GSTIN and PAN
 * are on the *Documents* step at the baseline, beside the KYC documents they
 * identify, not on the Business step. The second is **F042**.
 * ────────────────────────────────────────────────────────────────────────────
 */

async function setSession(value: string, expires: Date | undefined): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(expires ? { expires } : {}),
  });
}

/**
 * A form field as text. `FormData.get` can return a `File`, and `String(file)`
 * is `[object File]` — a value that would validate as a string and then be
 * saved as one. Anything that is not text reads as absent.
 */
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
