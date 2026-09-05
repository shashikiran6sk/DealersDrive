'use server';

import {
  AdminLoginInput,
  OnboardingInput,
  UpdateDealerInput,
  type AdminSessionResponse,
  type AuthSession,
  type DealerSubmitResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
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

/**
 * The fields steps 1 and 2 carry between them, in one list.
 *
 * They are echoed back on a rejection so a bad pincode does not cost the dealer
 * the other eight answers, and the list is written once because a field missing
 * from it fails silently — the form re-renders blank in exactly one box, which
 * is the kind of bug nobody reports.
 */
const ONBOARDING_FIELDS = [
  'fullName',
  'roleTitle',
  'phone',
  'legalName',
  'addressLine',
  'city',
  'state',
  'pincode',
  'landline',
] as const;

/** Dealer onboarding — the step between a verified Google identity and a tenant. */
export async function onboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    ONBOARDING_FIELDS.map((field) => [field, text(formData, field)]),
  );

  const parsed = OnboardingInput.safeParse({
    fullName: text(formData, 'fullName').trim(),
    roleTitle: emptyToUndefined(text(formData, 'roleTitle')),
    phone: text(formData, 'phone').trim(),
    legalName: text(formData, 'legalName').trim(),
    addressLine: text(formData, 'addressLine').trim(),
    city: text(formData, 'city').trim(),
    state: text(formData, 'state').trim(),
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
        errors: apiFieldErrors(error),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  redirect('/dealer/onboarding?step=2');
}

/**
 * Steps 1 and 2 again, for a dealership that already exists.
 *
 * `Back` from the documents step has to lead somewhere, and once a tenant has
 * been created the create path cannot be walked a second time — it would refuse
 * with `DEALER_ALREADY_EXISTS`. So the same two steps PATCH instead, which is
 * what `PATCH /v1/dealer` is partial for.
 *
 * `phone` is deliberately not sent. It is the login identity, and changing it
 * needs an OTP round-trip on the new number that onboarding does not have.
 */
export async function updateOnboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    ONBOARDING_FIELDS.map((field) => [field, text(formData, field)]),
  );

  const parsed = UpdateDealerInput.safeParse({
    legalName: text(formData, 'legalName').trim(),
    contact: {
      fullName: text(formData, 'fullName').trim(),
      roleTitle: text(formData, 'roleTitle').trim(),
      landline: text(formData, 'landline').trim(),
    },
    address: {
      line: text(formData, 'addressLine').trim(),
      city: text(formData, 'city').trim(),
      state: text(formData, 'state').trim(),
      pincode: text(formData, 'pincode').trim(),
    },
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error.issues), values };
  }

  try {
    await apiSend('PATCH', '/v1/dealer', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('That could not be saved.'),
        errors: apiFieldErrors(error),
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

/**
 * C2, from onboarding step 3 — the two registrations the KYC review needs
 * alongside the uploaded documents (DESIGN-SPEC §3.10).
 *
 * A separate write from the dealership itself because it happens after the
 * tenant exists, and because a dealer can come back to it: `PATCH /v1/dealer`
 * is partial, so filling one field never blanks the other.
 */
export async function saveBusinessIdsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    gstin: text(formData, 'gstin').trim().toUpperCase(),
    pan: text(formData, 'pan').trim().toUpperCase(),
  };

  const parsed = UpdateDealerInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values };

  try {
    await apiSend('PATCH', '/v1/dealer', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('Those could not be saved.'),
        errors: apiFieldErrors(error),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  revalidatePath('/dealer/onboarding');
  return { values, saved: true };
}

/**
 * C4 — the last step of onboarding: hand the dealership to a moderator.
 *
 * The dealer does not become ACTIVE here. This submits an *event*; the state
 * machine and an admin decide the rest (Rule 5), which is why the success path
 * lands on a "we're reviewing this" panel rather than on the dashboard.
 */
export async function submitForVerificationAction(): Promise<ActionState> {
  try {
    await apiSend<DealerSubmitResponse>('POST', '/v1/dealer/submit');
  } catch (error) {
    if (error instanceof ApiError) {
      return { message: error.userMessage('That could not be submitted yet.') };
    }
    return { message: 'The API is unavailable. Try again shortly.' };
  }

  redirect('/dealer/onboarding?step=3');
}

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

/**
 * A validation path, as the name of the input it belongs to.
 *
 * The wizard's fields are flat — `city`, `addressLine`, `pincode` — and both
 * validators answer in paths: Zod with `['address', 'city']`, the API with
 * `body.address.city`. Neither matches an input, so before this an error
 * against anything nested rendered against no field at all: the dealer saw a
 * banner saying something was wrong and not one box highlighted. Taking the
 * leaf fixes every case but one, and `line` is that one.
 */
const FORM_FIELD: Record<string, string> = { line: 'addressLine' };

function formField(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  return FORM_FIELD[leaf] ?? leaf;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = formField(issue.path.map(String).join('.'));
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}

/** The same, for the field errors the API answers a 400 or a 409 with. */
function apiFieldErrors(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [path, message] of Object.entries(error.fieldErrors())) {
    errors[formField(path)] ??= message;
  }
  return errors;
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
