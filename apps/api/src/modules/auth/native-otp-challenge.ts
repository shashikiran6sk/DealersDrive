import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { DomainError } from '../../platform/errors.js';
import { NATIVE_AUTH_MESSAGES } from './native-auth.messages.js';

export const NATIVE_CHALLENGE_TTL_SECONDS = 600;
const PURPOSE = 'NATIVE_CUSTOMER_OTP_V1';
const Challenge = z
  .object({
    purpose: z.literal(PURPOSE),
    phone: z.string().regex(/^\+91[6-9]\d{9}$/),
    reqId: z.string().min(1).max(512),
    nonce: z.string().min(16).max(64),
    issuedAt: z.number().int().positive(),
  })
  .strict();
export type NativeChallengeData = z.infer<typeof Challenge>;

export function issueNativeChallenge(phone: string, reqId: string, now = Date.now()) {
  return sealNativeChallenge({
    purpose: PURPOSE,
    phone,
    reqId,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: now,
  });
}

export function sealNativeChallenge(challenge: NativeChallengeData): string {
  const body = Buffer.from(JSON.stringify(challenge)).toString('base64url');
  return `${body}.${signature(body)}`;
}

export function openNativeChallenge(token: string, now = Date.now()): NativeChallengeData {
  const [body, supplied, extra] = token.split('.');
  if (!body || !supplied || extra !== undefined) throw expired();
  const expected = Buffer.from(signature(body));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw expired();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    throw expired();
  }
  const parsed = Challenge.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.issuedAt > now ||
    now - parsed.data.issuedAt >= NATIVE_CHALLENGE_TTL_SECONDS * 1000
  )
    throw expired();
  return parsed.data;
}

function signature(body: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(`${PURPOSE}.${body}`).digest('base64url');
}
export function expired(): DomainError {
  return new DomainError('NATIVE_OTP_EXPIRED', NATIVE_AUTH_MESSAGES.expired);
}
