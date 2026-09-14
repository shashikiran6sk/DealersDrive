import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient, SessionScope } from '@prisma/client';

export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export function ttlFor(scope: SessionScope): number {
  return scope === 'ADMIN' ? ADMIN_SESSION_TTL_SECONDS : DEALER_SESSION_TTL_SECONDS;
}

export function createSessionService(prisma: PrismaClient) {
  return {
    async issue(input: {
      userId: string;
      scope: SessionScope;
      ip?: string | undefined;
      userAgent?: string | undefined;
    }): Promise<IssuedSession> {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + ttlFor(input.scope) * 1000);

      await prisma.session.create({
        data: {
          userId: input.userId,
          scope: input.scope,
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

      return prisma.session.findFirst({
        where: {
          tokenHash: hashToken(token),
          scope,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: { include: { roles: true } } },
      });
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
