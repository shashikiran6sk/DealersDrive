import { normaliseIndianMobile } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, errorCode } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  ACCOUNT_LINK_REQUIRED,
  GOOGLE_ALREADY_LINKED,
  OTHER_GOOGLE_ALREADY_LINKED,
  PHONE_HELD_UNVERIFIED,
} from './auth.messages.js';
import type { OAuthClaims } from './oauth.port.js';
import type { ProvenPhone } from './phone-proof.service.js';

export interface IdentityDeps {
  prisma: PrismaClient;
  audit: AuditService;
}

export interface UserIdentities {
  google: { email: string; linkedAt: Date } | null;
  phone: { phone: string; verifiedAt: Date } | null;
  complete: boolean;
}

export interface PhoneAccount {
  userId: string;
  created: boolean;
}

export const IDENTITY_ALREADY_LINKED = 'IDENTITY_ALREADY_LINKED';

export function createIdentityService({ prisma, audit }: IdentityDeps) {
  async function holderOf(phone: string) {
    return prisma.user.findUnique({ where: { phone }, include: { roles: true } });
  }

  return {
    async identitiesOf(userId: string): Promise<UserIdentities> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          phone: true,
          phoneVerifiedAt: true,
          identities: {
            where: { provider: 'GOOGLE' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { email: true, createdAt: true },
          },
        },
      });

      const google = user?.identities[0];
      const phone =
        user?.phone && user.phoneVerifiedAt
          ? { phone: user.phone, verifiedAt: user.phoneVerifiedAt }
          : null;

      return {
        google: google ? { email: google.email, linkedAt: google.createdAt } : null,
        phone,
        complete: Boolean(google) && phone !== null,
      };
    },

    async findByVerifiedPhone(input: string) {
      const phone = normaliseIndianMobile(input);
      if (!phone) return null;

      const holder = await holderOf(phone);
      return holder?.phoneVerifiedAt ? holder : null;
    },

    async createWithPhone(
      proven: ProvenPhone,
      profile: { fullName?: string | null } = {},
    ): Promise<PhoneAccount> {
      try {
        const user = await prisma.user.create({
          data: {
            phone: proven.phone,
            phoneVerifiedAt: proven.provenAt,
            fullName: profile.fullName ?? null,
            lastLoginAt: new Date(),
          },
        });

        logger.info(
          { event: 'auth.identity.created', provider: 'PHONE', userId: user.id },
          'account created from a verified phone',
        );
        return { userId: user.id, created: true };
      } catch (error) {
        if (errorCode(error) !== 'P2002') throw error;
      }

      const holder = await holderOf(proven.phone);
      if (!holder?.phoneVerifiedAt) {
        logger.warn(
          { event: 'auth.identity.refused', provider: 'PHONE', reason: 'held-unverified' },
          'a proved phone is held, unverified, by another account',
        );
        throw new ConflictError(IDENTITY_ALREADY_LINKED, PHONE_HELD_UNVERIFIED);
      }

      return { userId: holder.id, created: false };
    },

    async createWithGoogle(claims: OAuthClaims): Promise<string> {
      const collision = await prisma.user.findUnique({
        where: { email: claims.email },
        include: { identities: true },
      });

      if (collision) {
        logger.warn(
          { event: 'auth.oauth.failed', reason: 'unlinked-account' },
          'google sign-in matched an existing email with no linked identity',
        );
        throw new ConflictError('ACCOUNT_LINK_REQUIRED', ACCOUNT_LINK_REQUIRED);
      }

      return withTransaction(prisma, async (tx) => {
        const user = await tx.user.create({
          data: {
            email: claims.email,
            emailVerifiedAt: new Date(),
            fullName: claims.name ?? null,
            lastLoginAt: new Date(),
          },
        });

        await tx.oAuthIdentity.create({
          data: {
            userId: user.id,
            provider: 'GOOGLE',
            providerSubject: claims.subject,
            email: claims.email,
            emailVerified: claims.emailVerified,
            displayName: claims.name ?? null,
            pictureUrl: claims.picture ?? null,
            lastLoginAt: new Date(),
          },
        });

        return user.id;
      });
    },

    async linkGoogle(userId: string, claims: OAuthClaims): Promise<{ linked: boolean }> {
      const now = new Date();

      try {
        return await withTransaction(prisma, async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;

          const bySubject = await tx.oAuthIdentity.findUnique({
            where: {
              provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject },
            },
          });

          if (bySubject && bySubject.userId !== userId) throw refusal('subject-held');

          if (bySubject) {
            await tx.oAuthIdentity.update({
              where: { id: bySubject.id },
              data: { email: claims.email, emailVerified: claims.emailVerified, lastLoginAt: now },
            });
            return { linked: false };
          }

          const own = await tx.oAuthIdentity.findFirst({
            where: { userId, provider: 'GOOGLE' },
            select: { id: true },
          });
          if (own) {
            throw new ConflictError(IDENTITY_ALREADY_LINKED, OTHER_GOOGLE_ALREADY_LINKED);
          }

          const emailHolder = await tx.user.findUnique({
            where: { email: claims.email },
            select: { id: true },
          });
          if (emailHolder && emailHolder.id !== userId) throw refusal('email-held');

          const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

          await tx.oAuthIdentity.create({
            data: {
              userId,
              provider: 'GOOGLE',
              providerSubject: claims.subject,
              email: claims.email,
              emailVerified: claims.emailVerified,
              displayName: claims.name ?? null,
              pictureUrl: claims.picture ?? null,
              lastLoginAt: now,
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: {
              email: user.email ?? claims.email,
              emailVerifiedAt: user.emailVerifiedAt ?? now,
              fullName: user.fullName ?? claims.name ?? null,
            },
          });

          await audit.record(tx, {
            actorType: 'DEALER',
            actorId: userId,
            action: 'auth.identity.linked',
            entityType: 'User',
            entityId: userId,
            after: { provider: 'GOOGLE' },
          });

          return { linked: true };
        });
      } catch (error) {
        if (errorCode(error) === 'P2002') throw refusal('lost-race');
        throw error;
      }
    },
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;

function refusal(reason: string): ConflictError {
  logger.warn(
    { event: 'auth.identity.refused', provider: 'GOOGLE', reason },
    'a google account already belongs to another account',
  );
  return new ConflictError(IDENTITY_ALREADY_LINKED, GOOGLE_ALREADY_LINKED);
}
