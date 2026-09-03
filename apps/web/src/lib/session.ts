import 'server-only';

import type { AuthSession } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { ApiError, apiGet, SESSION_COOKIE } from './api';

/**
 * Whether this request carries a session cookie at all.
 *
 * Deliberately *not* an authorization check: it says a cookie is present, not
 * that it is valid, and nothing may be shown or hidden on the strength of it.
 * It is used in exactly one place — to decide whether a 401 from the console
 * means "signed out" or "signed in, still onboarding".
 */
export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * The session the API recognises, or null.
 *
 * The sign-in screens ask *this* rather than `hasSession`, and the difference
 * is what stops a redirect loop: a cookie that exists but no longer works would
 * otherwise bounce sign-in → console → sign-in forever. A page that verifies
 * with the API instead renders the form and lets the person sign in again.
 */
export async function currentSession(): Promise<AuthSession | null> {
  try {
    return await apiGet<AuthSession>('/v1/auth/me', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * The same question for the admin console, whose sessions are a separate scope.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline types this `AdminOverview`, from `packages/contracts/src/admin.ts`
 * — the admin dashboard's whole response shape, which arrives with **F049**
 * along with the route it comes from. Every caller here asks one question of
 * the result, "is there one", so `unknown` is honest in the meantime and
 * narrows to the real shape — rather than changing — when F049 lands. `null`
 * is not spelled out in the return type only because `unknown` admits it.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function currentAdmin(): Promise<unknown> {
  try {
    return await apiGet<unknown>('/v1/admin/metrics/overview', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Where a signed-in dealer belongs, given what the API says about them. */
export function destinationFor(session: AuthSession): string {
  return session.next === 'ONBOARDING' ? '/dealer/onboarding' : '/dealer';
}
