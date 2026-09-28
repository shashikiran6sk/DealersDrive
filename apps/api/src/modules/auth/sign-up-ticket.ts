import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { normaliseIndianMobile } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, isRecord, UpstreamUnavailableError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import { OTP_UNAVAILABLE, SIGN_UP_EXPIRED } from './auth.messages.js';

export const SIGN_UP_TICKET_TTL_SECONDS = 600;

const PURPOSE = 'CUSTOMER_SIGN_UP';

export interface SignUpTicket {
  phone: string;
  nonce: string;
  issuedAt: number;
}

export function issueSignUpTicket(
  phone: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const ticket: SignUpTicket & { purpose: string } = {
    purpose: PURPOSE,
    phone,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: now,
  };
  const body = Buffer.from(JSON.stringify(ticket), 'utf8').toString('base64url');
  return {
    token: `${body}.${signature(body)}`,
    expiresAt: new Date(now + SIGN_UP_TICKET_TTL_SECONDS * 1000),
  };
}

export function openSignUpTicket(token: string, now = Date.now()): SignUpTicket | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  if (!matches(signature(body), token.slice(separator + 1))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.purpose !== PURPOSE) return null;
  const { phone, nonce, issuedAt } = parsed;
  if (typeof phone !== 'string' || typeof nonce !== 'string' || typeof issuedAt !== 'number') {
    return null;
  }
  if (normaliseIndianMobile(phone) !== phone) return null;
  if (now - issuedAt > SIGN_UP_TICKET_TTL_SECONDS * 1000 || issuedAt > now) return null;

  return { phone, nonce, issuedAt };
}

export async function redeemSignUpTicket(cache: CachePort, token: string): Promise<SignUpTicket> {
  const ticket = openSignUpTicket(token);
  if (!ticket) throw expired();

  const key = `customer-sign-up:spent:${createHash('sha256').update(ticket.nonce).digest('hex')}`;
  let seen: number;
  try {
    seen = (await cache.increment(key, SIGN_UP_TICKET_TTL_SECONDS)).count;
  } catch (error) {
    logger.warn({ err: error }, 'sign-up ticket guard unavailable — refusing the sign-up');
    throw new UpstreamUnavailableError(OTP_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
  }
  if (seen > 1) throw expired();

  return ticket;
}

function expired(): DomainError {
  return new DomainError('SIGN_UP_EXPIRED', SIGN_UP_EXPIRED, {
    errors: [{ field: 'body.signUpToken', code: 'SIGN_UP_EXPIRED', message: 'Expired.' }],
  });
}

function signature(body: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(`${PURPOSE}.${body}`).digest('base64url');
}

function matches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
