import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { IndianMobile, Uuid } from '@dealers-drive/contracts';
import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { DomainError, UpstreamUnavailableError } from '../../platform/errors.js';
import { CUSTOMER_REACTIVATION_EXPIRED, OTP_UNAVAILABLE } from './auth.messages.js';

const PURPOSE = 'CUSTOMER_REACTIVATION_V1';
const TTL_SECONDS = 600;
const Ticket = z
  .object({
    purpose: z.literal(PURPOSE),
    userId: Uuid,
    phone: IndianMobile,
    nonce: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    issuedAt: z.number().int().nonnegative(),
  })
  .strict();
function signature(body: string) {
  return createHmac('sha256', env.SESSION_SECRET).update(`${PURPOSE}.${body}`).digest('base64url');
}
function expired() {
  return new DomainError('CUSTOMER_REACTIVATION_EXPIRED', CUSTOMER_REACTIVATION_EXPIRED);
}
export function issueCustomerReactivation(userId: string, phone: string, now = Date.now()) {
  const body = Buffer.from(
    JSON.stringify(
      Ticket.parse({
        purpose: PURPOSE,
        userId,
        phone,
        nonce: randomBytes(16).toString('base64url'),
        issuedAt: now,
      }),
    ),
  ).toString('base64url');
  return { token: `${body}.${signature(body)}`, expiresAt: new Date(now + TTL_SECONDS * 1000) };
}
export async function redeemCustomerReactivation(cache: CachePort, token: string) {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) throw expired();
  const body = token.slice(0, separator);
  const expected = Buffer.from(signature(body));
  const provided = Buffer.from(token.slice(separator + 1));
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw expired();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw expired();
  }
  const ticket = Ticket.safeParse(value);
  if (
    !ticket.success ||
    ticket.data.issuedAt > Date.now() ||
    Date.now() - ticket.data.issuedAt > TTL_SECONDS * 1000
  )
    throw expired();
  let count: number;
  try {
    count = (
      await cache.increment(
        `customer-reactivation:spent:${createHash('sha256').update(ticket.data.nonce).digest('hex')}`,
        TTL_SECONDS,
      )
    ).count;
  } catch {
    throw new UpstreamUnavailableError(OTP_UNAVAILABLE, { code: 'PHONE_OTP_UNAVAILABLE' });
  }
  if (count > 1) throw expired();
  return ticket.data;
}
