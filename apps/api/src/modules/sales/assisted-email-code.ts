import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import {
  DomainError,
  isRecord,
  RateLimitError,
  UpstreamUnavailableError,
} from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  EMAIL_CODE_COOLDOWN,
  EMAIL_CODE_EXPIRED,
  EMAIL_CODE_INVALID,
  EMAIL_CODE_LOCKED,
  EMAIL_CODE_TOO_MANY,
  TICKET_GUARD_UNAVAILABLE,
} from './sales.messages.js';

export const EMAIL_CODE_TTL_SECONDS = 10 * 60;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_RESEND_SECONDS = 60;
export const EMAIL_CODE_HOURLY_LIMIT = 5;

const PURPOSE = 'ASSISTED_EMAIL_CODE';
const HOUR_SECONDS = 60 * 60;

export interface EmailChallenge {
  code: string;
  challenge: string;
  expiresAt: Date;
}

export interface ProvenEmail {
  email: string;
  provenAt: number;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mac(value: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(value).digest('base64url');
}

function codeMac(nonce: string, email: string, code: string): string {
  return mac(`${PURPOSE}.code.${nonce}.${email}.${code}`);
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function count(cache: CachePort, key: string, windowSeconds: number) {
  try {
    return await cache.increment(key, windowSeconds);
  } catch (error) {
    logger.warn({ err: error }, 'email code guard unavailable — refusing');
    throw new UpstreamUnavailableError(TICKET_GUARD_UNAVAILABLE, {
      code: 'EMAIL_CODE_UNAVAILABLE',
    });
  }
}

export async function assertMaySendCode(cache: CachePort, email: string): Promise<void> {
  const key = digest(email);
  const cooldown = await count(
    cache,
    `assisted-email-code:cooldown:${key}`,
    EMAIL_CODE_RESEND_SECONDS,
  );
  if (cooldown.count > 1) {
    throw new RateLimitError(
      EMAIL_CODE_COOLDOWN(cooldown.retryAfterSeconds),
      cooldown.retryAfterSeconds,
      { code: 'EMAIL_CODE_COOLDOWN' },
    );
  }
  const hourly = await count(cache, `assisted-email-code:hourly:${key}`, HOUR_SECONDS);
  if (hourly.count > EMAIL_CODE_HOURLY_LIMIT) {
    throw new RateLimitError(EMAIL_CODE_TOO_MANY, hourly.retryAfterSeconds, {
      code: 'EMAIL_CODE_TOO_MANY',
    });
  }
}

export function issueEmailChallenge(
  email: string,
  memberId: string,
  now = Date.now(),
): EmailChallenge {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const nonce = randomBytes(16).toString('base64url');
  const payload = {
    purpose: PURPOSE,
    email,
    memberId,
    nonce,
    issuedAt: now,
    codeMac: codeMac(nonce, email, code),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return {
    code,
    challenge: `${body}.${mac(`${PURPOSE}.${body}`)}`,
    expiresAt: new Date(now + EMAIL_CODE_TTL_SECONDS * 1000),
  };
}

function invalid(message: string, code: string): DomainError {
  return new DomainError(code, message, { errors: [{ field: 'body.code', code, message }] });
}

export async function verifyEmailChallenge(
  cache: CachePort,
  challenge: string,
  code: string,
  memberId: string,
  now = Date.now(),
): Promise<ProvenEmail> {
  const separator = challenge.lastIndexOf('.');
  const body = separator > 0 ? challenge.slice(0, separator) : '';
  if (!body || !equal(mac(`${PURPOSE}.${body}`), challenge.slice(separator + 1))) {
    throw invalid(EMAIL_CODE_EXPIRED, 'EMAIL_CODE_EXPIRED');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw invalid(EMAIL_CODE_EXPIRED, 'EMAIL_CODE_EXPIRED');
  }
  if (
    !isRecord(parsed) ||
    parsed.purpose !== PURPOSE ||
    parsed.memberId !== memberId ||
    typeof parsed.email !== 'string' ||
    typeof parsed.nonce !== 'string' ||
    typeof parsed.issuedAt !== 'number' ||
    typeof parsed.codeMac !== 'string'
  ) {
    throw invalid(EMAIL_CODE_EXPIRED, 'EMAIL_CODE_EXPIRED');
  }
  const { email, nonce, issuedAt } = parsed;
  if (now - issuedAt > EMAIL_CODE_TTL_SECONDS * 1000 || issuedAt > now) {
    throw invalid(EMAIL_CODE_EXPIRED, 'EMAIL_CODE_EXPIRED');
  }

  const key = digest(nonce);
  const attempts = await count(
    cache,
    `assisted-email-code:attempts:${key}`,
    EMAIL_CODE_TTL_SECONDS,
  );
  if (attempts.count > EMAIL_CODE_MAX_ATTEMPTS) {
    throw invalid(EMAIL_CODE_LOCKED, 'EMAIL_CODE_LOCKED');
  }
  if (!equal(codeMac(nonce, email, code), parsed.codeMac)) {
    throw invalid(EMAIL_CODE_INVALID, 'EMAIL_CODE_INVALID');
  }

  const spent = await count(cache, `assisted-email-code:spent:${key}`, EMAIL_CODE_TTL_SECONDS);
  if (spent.count > 1) throw invalid(EMAIL_CODE_EXPIRED, 'EMAIL_CODE_EXPIRED');

  return { email, provenAt: now };
}
