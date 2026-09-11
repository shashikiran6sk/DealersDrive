import { randomUUID } from 'node:crypto';

import { formatPhone, type PhoneVerificationStartResponse } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import type { Tx } from '../../platform/db/prisma.js';
import {
  ConflictError,
  RateLimitError,
  UnauthorizedError,
  UpstreamUnavailableError,
} from '../../platform/errors.js';
import type { PhoneVerifierPort } from '../../platform/phone/phone.port.js';

const TTL_SECONDS = 300;
const RESEND_SECONDS = 60;

/** Serializes provider calls for a phone across API instances. MSG91's Verify
 * endpoint is phone-scoped: a second user must not replace a live challenge.
 * Provider requests are bounded to 5 seconds; the transaction has 15 seconds.
 * Attempts live in CachePort so a rejected transaction cannot restore guesses.
 */
export function createPhoneChallenges(
  prisma: PrismaClient,
  cache: CachePort,
  provider: PhoneVerifierPort,
) {
  async function limit(key: string, maximum: number, seconds: number): Promise<void> {
    let result;
    try {
      result = await cache.increment(`phone:${key}`, seconds);
    } catch {
      // A paid endpoint must fail closed even when the generic limiter does not.
      throw new UpstreamUnavailableError('Phone verification is temporarily unavailable.', {
        code: 'PHONE_VERIFICATION_UNAVAILABLE',
      });
    }
    if (result.count > maximum) {
      throw new RateLimitError(
        'Too many attempts. Please wait before trying again.',
        result.retryAfterSeconds,
        { code: 'PHONE_RATE_LIMITED' },
      );
    }
  }

  return {
    async start(
      userId: string,
      phone: string,
      ip: string,
    ): Promise<PhoneVerificationStartResponse> {
      await limit(`send:user:${userId}`, env.PHONE_SEND_USER_LIMIT, 3600);
      await limit(`send:ip:${ip}`, env.PHONE_SEND_IP_LIMIT, 3600);
      await limit(`send:number:${phone}`, 5, 3600);
      await limit('send:daily', env.PHONE_SEND_DAILY_LIMIT, 86400);

      return prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
          const previous = await tx.phoneVerificationChallenge.findUnique({ where: { phone } });
          const now = new Date();
          if (
            previous &&
            previous.expiresAt > now &&
            !previous.consumedAt &&
            previous.userId !== userId
          ) {
            throw new ConflictError(
              'PHONE_VERIFICATION_PENDING',
              'A verification is already in progress for that number. Try again in five minutes.',
            );
          }
          if (previous && now.getTime() - previous.sentAt.getTime() < RESEND_SECONDS * 1000) {
            throw new RateLimitError(
              'Wait a minute before sending another code.',
              Math.max(
                1,
                Math.ceil(
                  (previous.sentAt.getTime() + RESEND_SECONDS * 1000 - now.getTime()) / 1000,
                ),
              ),
              { code: 'PHONE_RATE_LIMITED' },
            );
          }
          await provider.send(phone);
          const sentAt = new Date();
          const data = {
            id: randomUUID(),
            userId,
            phone,
            sentAt,
            expiresAt: new Date(sentAt.getTime() + TTL_SECONDS * 1000),
            consumedAt: null,
          };
          await tx.phoneVerificationChallenge.upsert({
            where: { phone },
            create: data,
            update: data,
          });
          return {
            challengeId: data.id,
            phone,
            phoneDisplay: formatPhone(phone),
            expiresAt: data.expiresAt.toISOString(),
            resendAfterSeconds: RESEND_SECONDS,
          };
        },
        { timeout: 15000 },
      );
    },

    async verify<T>(
      userId: string,
      challengeId: string,
      code: string,
      apply: (tx: Tx, phone: string) => Promise<T>,
    ): Promise<T> {
      // Also bound probes for nonexistent and other users' challenge ids.
      await limit(`verify:user:${userId}`, 30, 300);
      return prisma.$transaction(
        async (tx) => {
          const initial = await tx.phoneVerificationChallenge.findUnique({
            where: { id: challengeId },
          });
          if (!initial || initial.userId !== userId) throw expired();
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.phone}))`;
          // Re-read after the lock: a resend could have replaced this challenge.
          const challenge = await tx.phoneVerificationChallenge.findUnique({
            where: { id: challengeId },
          });
          if (
            !challenge ||
            challenge.userId !== userId ||
            challenge.consumedAt ||
            challenge.expiresAt <= new Date()
          )
            throw expired();
          await limit(`verify:challenge:${challengeId}`, 5, TTL_SECONDS);
          await provider.verify(challenge.phone, code);
          if (challenge.expiresAt <= new Date()) throw expired();
          // Serialize changes to the same user even when two different phones
          // were challenged. Consume proof and update both phone mirrors together.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
          const result = await apply(tx, challenge.phone);
          await tx.phoneVerificationChallenge.update({
            where: { id: challengeId },
            data: { consumedAt: new Date() },
          });
          return result;
        },
        { timeout: 15000 },
      );
    },
  };
}

function expired(): UnauthorizedError {
  return new UnauthorizedError('That code has expired. Send a new one.', {
    code: 'PHONE_CODE_EXPIRED',
  });
}
