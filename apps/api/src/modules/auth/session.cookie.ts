import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { isRecord } from '../../platform/errors.js';
import { OAUTH_COOKIE } from './oauth-transaction.js';

export const SESSION_COOKIE = 'dd_session';
export const ADMIN_SESSION_COOKIE = 'dd_admin_session';
export const ADMIN_OAUTH_COOKIE = 'dd_admin_oauth';

export function readSessionToken(req: Request): string | undefined {
  return cookieOf(req, SESSION_COOKIE);
}

export function readAdminSessionToken(req: Request): string | undefined {
  return cookieOf(req, ADMIN_SESSION_COOKIE);
}

export function readAdminOAuthCookie(req: Request): string | undefined {
  return cookieOf(req, ADMIN_OAUTH_COOKIE);
}

export function readOAuthCookie(req: Request): string | undefined {
  return cookieOf(req, OAUTH_COOKIE);
}

function cookieOf(req: Request, name: string): string | undefined {
  const value: unknown = isRecord(req.cookies) ? req.cookies[name] : undefined;
  return typeof value === 'string' ? value : undefined;
}

interface CookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
}

function baseAttributes(): CookieAttributes {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  admin = false,
): void {
  res.cookie(admin ? ADMIN_SESSION_COOKIE : SESSION_COOKIE, token, {
    ...baseAttributes(),
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseAttributes());
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, baseAttributes());
}

export function setOAuthCookie(
  res: Response,
  sealed: string,
  maxAgeSeconds: number,
  admin = false,
): void {
  res.cookie(admin ? ADMIN_OAUTH_COOKIE : OAUTH_COOKIE, sealed, {
    ...baseAttributes(),
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearOAuthCookie(res: Response, admin = false): void {
  res.clearCookie(admin ? ADMIN_OAUTH_COOKIE : OAUTH_COOKIE, baseAttributes());
}
