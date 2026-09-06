import { env } from '../../config/env.js';

/**
 * Who is allowed to hold an admin session.
 *
 * One function, consulted in two places that must never disagree: when a
 * session is *issued* (the Google callback) and every time one is *resolved*
 * (`resolveAdmin`). Checking only at issue time would leave a console open for
 * up to twelve hours after an address was taken off the list, which is exactly
 * the window that matters when somebody leaves.
 *
 * The comparison is case-insensitive and trimmed on both sides, because the
 * value on the left came out of a `.env` file typed by a human and the value on
 * the right came out of a Google identity token. Neither is canonical.
 *
 * Everything else about the address is Google's problem: this function is asked
 * only about a `claims.email` that arrived inside a token Google signed, never
 * about a string a client sent.
 */
export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminAllowlist.includes(email.trim().toLowerCase());
}
