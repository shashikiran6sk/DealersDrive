import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { OAUTH_COOKIE } from './oauth-transaction.js';

/**
 * The cookies, and only the cookies.
 *
 * Separated from `session.service.ts` because that file is a *service*: it
 * takes a user id and returns a token, and can be tested without an HTTP
 * request in sight. Everything on this side of the line needs `req` or `res`,
 * which is exactly what belongs at the edge (ARCHITECTURE §5.4).
 */
export const SESSION_COOKIE = 'dd_session';

export function readSessionToken(req: Request): string | undefined {
  return cookieOf(req, SESSION_COOKIE);
}

export function readOAuthCookie(req: Request): string | undefined {
  return cookieOf(req, OAUTH_COOKIE);
}

/**
 * `cookie-parser` populates `req.cookies`; this narrows it back to a string
 * without an assertion, because a repeated cookie header arrives as an array.
 */
function cookieOf(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}

interface CookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
}

/**
 * `SameSite=Lax`, not `Strict`, and that is required rather than lax thinking:
 * the OAuth callback is a top-level cross-site GET from Google, and `Strict`
 * would withhold the cookie on exactly that navigation.
 *
 * Lax also does the CSRF work here — the browser will not attach this cookie to
 * a cross-site POST — which, together with a CORS allow-list that names one
 * origin, is what protects the state-changing routes.
 */
function baseAttributes(): CookieAttributes {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { ...baseAttributes(), expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseAttributes());
}

export function setOAuthCookie(res: Response, sealed: string, maxAgeSeconds: number): void {
  res.cookie(OAUTH_COOKIE, sealed, { ...baseAttributes(), maxAge: maxAgeSeconds * 1000 });
}

export function clearOAuthCookie(res: Response): void {
  res.clearCookie(OAUTH_COOKIE, baseAttributes());
}
