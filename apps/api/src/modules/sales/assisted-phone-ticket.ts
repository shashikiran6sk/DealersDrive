import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { normaliseIndianMobile } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, isRecord, UpstreamUnavailableError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import { PHONE_TICKET_EXPIRED, TICKET_GUARD_UNAVAILABLE } from './sales.messages.js';

export const ASSISTED_PHONE_TICKET_TTL_SECONDS = 30 * 60;

const PURPOSE = 'ASSISTED_DEALER_PHONE';

export interface AssistedPhoneTicket {
  phone: string;
  memberId: string;
  nonce: string;
  provenAt: number;
}

export function issueAssistedPhoneTicket(
  phone: string,
  memberId: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const ticket = {
    purpose: PURPOSE,
    phone,
    memberId,
    nonce: randomBytes(16).toString('base64url'),
    provenAt: now,
  };
  const body = Buffer.from(JSON.stringify(ticket), 'utf8').toString('base64url');
  return {
    token: `${body}.${signature(body)}`,
    expiresAt: new Date(now + ASSISTED_PHONE_TICKET_TTL_SECONDS * 1000),
  };
}

export function openAssistedPhoneTicket(
  token: string,
  memberId: string,
  now = Date.now(),
): AssistedPhoneTicket | null {
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
  const { phone, nonce, provenAt } = parsed;
  if (
    typeof phone !== 'string' ||
    typeof nonce !== 'string' ||
    typeof provenAt !== 'number' ||
    parsed.memberId !== memberId
  ) {
    return null;
  }
  if (normaliseIndianMobile(phone) !== phone) return null;
  if (now - provenAt > ASSISTED_PHONE_TICKET_TTL_SECONDS * 1000 || provenAt > now) return null;

  return { phone, memberId, nonce, provenAt };
}

export async function redeemAssistedPhoneTicket(
  cache: CachePort,
  token: string,
  memberId: string,
): Promise<AssistedPhoneTicket> {
  const ticket = openAssistedPhoneTicket(token, memberId);
  if (!ticket) throw expired();

  const key = `assisted-phone:spent:${createHash('sha256').update(ticket.nonce).digest('hex')}`;
  let seen: number;
  try {
    seen = (await cache.increment(key, ASSISTED_PHONE_TICKET_TTL_SECONDS)).count;
  } catch (error) {
    logger.warn({ err: error }, 'assisted phone ticket guard unavailable — refusing');
    throw new UpstreamUnavailableError(TICKET_GUARD_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
  }
  if (seen > 1) throw expired();

  return ticket;
}

function expired(): DomainError {
  return new DomainError('PHONE_TICKET_EXPIRED', PHONE_TICKET_EXPIRED, {
    errors: [{ field: 'body.phoneTicket', code: 'PHONE_TICKET_EXPIRED', message: 'Expired.' }],
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
