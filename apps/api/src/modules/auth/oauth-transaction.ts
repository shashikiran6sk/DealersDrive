import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { isRecord } from '../../platform/errors.js';

export const OAUTH_COOKIE = 'dd_oauth';

export const OAUTH_TRANSACTION_TTL_SECONDS = 600;

export type OAuthAudience = 'DEALER' | 'ADMIN';

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  audience: OAuthAudience;
  returnTo: string;
  issuedAt: number;
}

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
    codeVerifier: randomBytes(32).toString('base64url'),
    audience,
    returnTo: safeReturnTo(returnTo, DEFAULT_RETURN_TO[audience]),
    issuedAt: Date.now(),
  };
}

export function sealTransaction(transaction: OAuthTransaction): string {
  const body = Buffer.from(JSON.stringify(transaction), 'utf8').toString('base64url');
  return `${body}.${signature(body)}`;
}

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

  if (!isRecord(parsed)) return null;
  const { state, nonce, codeVerifier, returnTo, issuedAt, audience } = parsed;

  if (
    typeof state !== 'string' ||
    typeof nonce !== 'string' ||
    typeof codeVerifier !== 'string' ||
    typeof returnTo !== 'string' ||
    typeof issuedAt !== 'number' ||
    (audience !== 'DEALER' && audience !== 'ADMIN')
  ) {
    return null;
  }

  if (Date.now() - issuedAt > OAUTH_TRANSACTION_TTL_SECONDS * 1000) return null;

  return { state, nonce, codeVerifier, returnTo, issuedAt, audience };
}

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
