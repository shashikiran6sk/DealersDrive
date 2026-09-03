import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient, SessionScope } from '@prisma/client';

/**
 * Sessions — opaque tokens in Postgres, not JWTs (ARCHITECTURE §8.2).
 *
 * The value in the cookie is 32 random bytes and means nothing on its own; only
 * its SHA-256 is stored, so a leaked database dump does not hand anyone a live
 * session. The reason for the whole design is one line of SQL: suspending a
 * dealer, or signing them out everywhere, is an UPDATE that takes effect on the
 * very next request. A JWT would need a denylist — which is a database, only
 * slower to consult and easier to forget.
 */
/** §8.2 — 30 days for a dealer, 12 hours for an admin. */
export const DEALER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export function ttlFor(scope: SessionScope): number {
  return scope === 'ADMIN' ? ADMIN_SESSION_TTL_SECONDS : DEALER_SESSION_TTL_SECONDS;
}

/** The token is returned exactly once, here. It is never stored or logged. */
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

    /**
     * The live session behind a token, or null. Expiry and revocation are part
     * of the query rather than a check afterwards, so there is no window where
     * a revoked row is read and then acted on.
     */
    async resolve(token: string | undefined, scope: SessionScope) {
      if (!token) return null;

      return prisma.session.findFirst({
        where: {
          tokenHash: hashToken(token),
          scope,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
    },

    /** Idempotent: signing out twice is not an error, and must not be. */
    async revoke(token: string | undefined): Promise<void> {
      if (!token) return;
      await prisma.session.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    /** Every seat, everywhere — used when an account is suspended or compromised. */
    async revokeAllForUser(userId: string): Promise<void> {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
