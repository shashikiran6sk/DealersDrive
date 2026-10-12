import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { normaliseIndianMobile } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, isRecord, UpstreamUnavailableError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  EMAIL_TICKET_EXPIRED,
  PHONE_TICKET_EXPIRED,
  TICKET_GUARD_UNAVAILABLE,
} from './sales.messages.js';

export const ASSISTED_TICKET_TTL_SECONDS = 30 * 60;

export type AssistedTicketKind = 'PHONE' | 'EMAIL';

const PURPOSES: Record<AssistedTicketKind, string> = {
  PHONE: 'ASSISTED_DEALER_PHONE',
  EMAIL: 'ASSISTED_DEALER_EMAIL',
};

export interface AssistedTicket {
  kind: AssistedTicketKind;
  value: string;
  memberId: string;
  nonce: string;
  provenAt: number;
}

export function issueAssistedTicket(
  kind: AssistedTicketKind,
  value: string,
  memberId: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  const ticket = {
    purpose: PURPOSES[kind],
    value,
    memberId,
    nonce: randomBytes(16).toString('base64url'),
    provenAt: now,
  };
  const body = Buffer.from(JSON.stringify(ticket), 'utf8').toString('base64url');
  return {
    token: `${body}.${signature(kind, body)}`,
    expiresAt: new Date(now + ASSISTED_TICKET_TTL_SECONDS * 1000),
  };
}

function canonical(kind: AssistedTicketKind, value: string): boolean {
  return kind === 'PHONE' ? normaliseIndianMobile(value) === value : value === value.toLowerCase();
}

export function openAssistedTicket(
  kind: AssistedTicketKind,
  token: string,
  memberId: string,
  now = Date.now(),
): AssistedTicket | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  if (!matches(signature(kind, body), token.slice(separator + 1))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.purpose !== PURPOSES[kind]) return null;
  const { value, nonce, provenAt } = parsed;
  if (
    typeof value !== 'string' ||
    typeof nonce !== 'string' ||
    typeof provenAt !== 'number' ||
    parsed.memberId !== memberId
  ) {
    return null;
  }
  if (!canonical(kind, value)) return null;
  if (now - provenAt > ASSISTED_TICKET_TTL_SECONDS * 1000 || provenAt > now) return null;

  return { kind, value, memberId, nonce, provenAt };
}

function spentKey(ticket: AssistedTicket): string {
  const digest = createHash('sha256').update(ticket.nonce).digest('hex');
  return `assisted-${ticket.kind.toLowerCase()}:spent:${digest}`;
}

export async function openUnspentTicket(
  cache: CachePort,
  kind: AssistedTicketKind,
  token: string,
  memberId: string,
): Promise<AssistedTicket> {
  const ticket = openAssistedTicket(kind, token, memberId);
  if (!ticket) throw expiredTicket(kind);
  let seen: number;
  try {
    seen = await cache.peek(spentKey(ticket));
  } catch (error) {
    logger.warn({ err: error, kind }, 'assisted ticket guard unavailable — refusing');
    throw new UpstreamUnavailableError(TICKET_GUARD_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
  }
  if (seen > 0) throw expiredTicket(kind);
  return ticket;
}

export async function redeemAssistedTicket(
  cache: CachePort,
  kind: AssistedTicketKind,
  token: string,
  memberId: string,
): Promise<AssistedTicket> {
  const ticket = openAssistedTicket(kind, token, memberId);
  if (!ticket) throw expiredTicket(kind);

  let seen: number;
  try {
    seen = (await cache.increment(spentKey(ticket), ASSISTED_TICKET_TTL_SECONDS)).count;
  } catch (error) {
    logger.warn({ err: error, kind }, 'assisted ticket guard unavailable — refusing');
    throw new UpstreamUnavailableError(TICKET_GUARD_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
  }
  if (seen > 1) throw expiredTicket(kind);

  return ticket;
}

export function expiredTicket(kind: AssistedTicketKind): DomainError {
  const field = kind === 'PHONE' ? 'body.phoneTicket' : 'body.emailTicket';
  const code = kind === 'PHONE' ? 'PHONE_TICKET_EXPIRED' : 'EMAIL_TICKET_EXPIRED';
  const message = kind === 'PHONE' ? PHONE_TICKET_EXPIRED : EMAIL_TICKET_EXPIRED;
  return new DomainError(code, message, { errors: [{ field, code, message: 'Expired.' }] });
}

function signature(kind: AssistedTicketKind, body: string): string {
  return createHmac('sha256', env.SESSION_SECRET)
    .update(`${PURPOSES[kind]}.${body}`)
    .digest('base64url');
}

function matches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
