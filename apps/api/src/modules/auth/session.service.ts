import { createHash, randomBytes } from 'node:crypto';

import type { Prisma, PrismaClient, SessionScope } from '@prisma/client';

import { logger } from '../../platform/telemetry/logger.js';

export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;

export const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

export const PERSON_SCOPES = ['DEALER', 'CUSTOMER'] as const satisfies readonly SessionScope[];

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export function ttlFor(scope: SessionScope): number {
  return scope === 'ADMIN' ? ADMIN_SESSION_TTL_SECONDS : DEALER_SESSION_TTL_SECONDS;
}

export function createSessionService(prisma: PrismaClient) {
  async function markSeen<T extends { id: string; lastSeenAt: Date }>(
    session: T | null,
  ): Promise<T | null> {
    if (!session) return null;

    const now = new Date();
    if (now.getTime() - session.lastSeenAt.getTime() < LAST_SEEN_REFRESH_MS) return session;

    try {
      await prisma.session.updateMany({
        where: { id: session.id, lastSeenAt: session.lastSeenAt },
        data: { lastSeenAt: now },
      });
    } catch (error) {
      logger.warn(
        { event: 'auth.session.last_seen_failed', sessionId: session.id, err: error },
        'session last-seen refresh failed',
      );
    }

    return session;
  }

  return {
    async issue(
      input: {
        userId: string;
        scope: SessionScope;
        authenticationMethod?: 'GOOGLE' | 'PHONE_OTP';
        ip?: string | undefined;
        userAgent?: string | undefined;
      },
      db: PrismaClient | Prisma.TransactionClient = prisma,
    ): Promise<IssuedSession> {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + ttlFor(input.scope) * 1000);

      await db.session.create({
        data: {
          userId: input.userId,
          scope: input.scope,
          authenticationMethod: input.authenticationMethod ?? null,
          tokenHash: hashToken(token),
          expiresAt,
          ip: input.ip ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
        },
      });

      return { token, expiresAt };
    },

    async resolve(token: string | undefined, scope: SessionScope) {
      if (!token) return null;

      const session = await prisma.session.findFirst({
        where: {
          tokenHash: hashToken(token),
          scope,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: { include: { roles: true, adminMember: true } } },
      });

      return markSeen(session);
    },

    async resolvePerson(token: string | undefined) {
      if (!token) return null;

      const session = await prisma.session.findFirst({
        where: {
          tokenHash: hashToken(token),
          scope: { in: [...PERSON_SCOPES] },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: { include: { roles: true } } },
      });

      return markSeen(session);
    },

    async setActiveDealer(sessionId: string, dealerId: string): Promise<void> {
      await prisma.session.update({ where: { id: sessionId }, data: { activeDealerId: dealerId } });
    },

    async revoke(token: string | undefined): Promise<void> {
      if (!token) return;
      await prisma.session.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async revokeAllForUser(userId: string, scope?: SessionScope): Promise<void> {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null, ...(scope ? { scope } : {}) },
        data: { revokedAt: new Date() },
      });
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
