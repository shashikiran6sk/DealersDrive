import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { isRecord } from '../../platform/errors.js';
import { OAUTH_COOKIE } from './oauth-transaction.js';

export const SESSION_COOKIE = 'dd_session';

export function readSessionToken(req: Request): string | undefined {
  return cookieOf(req, SESSION_COOKIE);
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
