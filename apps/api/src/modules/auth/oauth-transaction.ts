import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';

/**
 * The half of the OAuth round trip that has to survive a redirect to Google
 * and back, without the API keeping server state for every abandoned sign-in.
 *
 * It is sealed into one short-lived HttpOnly cookie: the CSRF `state`, the OIDC
 * `nonce`, the PKCE verifier and where to land afterwards. HMAC-signed, so the
 * browser holding it cannot edit any of those; ten-minute lifetime, so a
 * captured cookie is worthless by the time anyone reads it.
 *
 * Why a cookie and not a `oauth_states` table: the row would exist only between
 * two requests seconds apart, and would need its own expiry sweep. The cookie is
 * already scoped to exactly the browser that must present it.
 */
export const OAUTH_COOKIE = 'dd_oauth';

/** Longer than any human takes at Google's account chooser, short enough to be useless later. */
export const OAUTH_TRANSACTION_TTL_SECONDS = 600;

/**
 * Which console this sign-in is for.
 *
 * It is decided at `/start` and sealed, rather than being read off the callback
 * — because it selects the *scope of the session that gets issued*, and a value
 * the browser could change on the way back would be a way to ask for an admin
 * session from the dealer button. Google's redirect URI is registered once and
 * shared by both flows; this field is what tells them apart when it returns.
 */
export type OAuthAudience = 'DEALER' | 'ADMIN';

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  audience: OAuthAudience;
  /** A *path* on the web app, never an absolute URL — see `safeReturnTo`. */
  returnTo: string;
  issuedAt: number;
}

/** Where each console lands when nothing else was asked for. */
export const DEFAULT_RETURN_TO: Record<OAuthAudience, string> = {
  DEALER: '/dealer',
  ADMIN: '/admin',
};

export function createOAuthTransaction(
  returnTo: string,
  audience: OAuthAudience = 'DEALER',
): OAuthTransaction {
  return {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    // RFC 7636 §4.1 — 43-128 characters of unreserved ASCII. 32 random bytes
    // base64url-encoded lands at 43.
    codeVerifier: randomBytes(32).toString('base64url'),
    audience,
    returnTo: safeReturnTo(returnTo, DEFAULT_RETURN_TO[audience]),
    issuedAt: Date.now(),
  };
}

/** `<base64url(json)>.<hmac>` */
export function sealTransaction(transaction: OAuthTransaction): string {
  const body = Buffer.from(JSON.stringify(transaction), 'utf8').toString('base64url');
  return `${body}.${signature(body)}`;
}

/** Null for anything tampered with, unreadable or expired. Never throws. */
export function openTransaction(sealed: string | undefined): OAuthTransaction | null {
  if (!sealed) return null;

  const separator = sealed.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = sealed.slice(0, separator);
  const provided = sealed.slice(separator + 1);
  if (!matches(signature(body), provided)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const transaction = parsed as Partial<OAuthTransaction>;
  if (
    typeof transaction.state !== 'string' ||
    typeof transaction.nonce !== 'string' ||
    typeof transaction.codeVerifier !== 'string' ||
    typeof transaction.returnTo !== 'string' ||
    typeof transaction.issuedAt !== 'number' ||
    // Unrecognised is not "assume admin" and not "assume dealer": it is a
    // cookie this build did not mint, and the callback has nothing to do with
    // it. Refusing here costs a person one click on a sign-in page.
    (transaction.audience !== 'DEALER' && transaction.audience !== 'ADMIN')
  ) {
    return null;
  }

  if (Date.now() - transaction.issuedAt > OAUTH_TRANSACTION_TTL_SECONDS * 1000) return null;

  return transaction as OAuthTransaction;
}

/**
 * An open redirect is the classic way an OAuth callback leaks a session, so
 * `returnTo` is reduced to a same-site path or dropped entirely. `//evil.com`
 * is a protocol-relative URL, which is why the second character is checked too.
 */
export function safeReturnTo(candidate: string | undefined, fallback = '/dealer'): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\') || candidate.includes('\n')) return fallback;
  return candidate;
}

function signature(body: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(body).digest('base64url');
}

function matches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
