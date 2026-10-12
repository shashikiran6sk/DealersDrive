import { createHash, randomBytes } from 'node:crypto';
import {
  normaliseIndianMobile,
  type AdminPhonePurpose,
  type AdminPhoneVerifyInput,
} from '@dealers-drive/contracts';
import { Prisma, type PrismaClient, type AdminPhoneCredential } from '@prisma/client';
import { env } from '../../config/env.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import {
  ConflictError,
  ForbiddenError,
  RateLimitError,
  UpstreamUnavailableError,
} from '../../platform/errors.js';
import { ADMIN_MEMBERSHIP_LOCK, isAdmitted, permissionsForMember } from './admin-member.js';
import { isSeatSuspended } from './roles.js';
import type { AdminPrincipal } from './session.port.js';
import { hashToken, type SessionService } from './session.service.js';
import type { PhoneProofService } from './phone-proof.service.js';

const TTL_MS = 300_000;
const STEP_UP_MS = 600_000;
const REFUSED = 'That verification could not be completed. Start again or continue with Google.';
type Tx = Prisma.TransactionClient;

export function createAdminPhoneService({
  prisma,
  sessions,
  proof,
  cache,
  audit,
}: {
  prisma: PrismaClient;
  sessions: SessionService;
  proof: PhoneProofService;
  cache: CachePort;
  audit: AuditService;
}) {
  async function admitted(tx: Tx, userId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADMIN_MEMBERSHIP_LOCK}))`;
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "admin_members" WHERE "userId" = ${userId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "user_roles" WHERE "userId" = ${userId}::uuid AND "role" = 'ADMIN' FOR SHARE`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { adminMember: true, roles: true },
    });
    if (
      !user ||
      !isAdmitted({ email: user.email, status: user.status, member: user.adminMember }) ||
      isSeatSuspended(user.roles, 'ADMIN') ||
      !user.adminMember ||
      !permissionsForMember(user.adminMember.role).includes('admin:console')
    )
      throw refused();
    return user;
  }

  async function stepUp(tx: Tx, actor: AdminPrincipal) {
    await admitted(tx, actor.userId);
    if (actor.sessionId)
      await tx.$queryRaw`SELECT "id" FROM "sessions" WHERE "id" = ${actor.sessionId}::uuid FOR SHARE`;
    const session = actor.sessionId
      ? await tx.session.findUnique({ where: { id: actor.sessionId } })
      : null;
    if (
      !session ||
      session.userId !== actor.userId ||
      session.scope !== 'ADMIN' ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.authenticationMethod !== 'GOOGLE' ||
      session.createdAt.getTime() < Date.now() - STEP_UP_MS
    ) {
      throw new ForbiddenError('Continue with Google again before changing mobile security.', {
        code: 'ADMIN_GOOGLE_REAUTH_REQUIRED',
      });
    }
    return session;
  }

  async function lockCredential(tx: Tx, userId: string) {
    await tx.$queryRaw`SELECT "id" FROM "admin_phone_credentials" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
    return tx.adminPhoneCredential.findUnique({ where: { userId } });
  }

  return {
    widget() {
      const widget = proof.widget();
      if (widget.driver === 'msg91' && !env.MSG91_AUTH_KEY)
        return {
          ...widget,
          enabled: false,
          reason: 'Mobile sign-in is unavailable. Continue with Google.',
        };
      return widget;
    },

    async security(actor: AdminPrincipal) {
      const credential = await prisma.adminPhoneCredential.findUnique({
        where: { userId: actor.userId },
      });
      const session = actor.sessionId
        ? await prisma.session.findUnique({ where: { id: actor.sessionId } })
        : null;
      const linked = Boolean(credential && !credential.revokedAt);
      return {
        linked,
        phoneMasked: linked && credential ? `+91 ••••••${credential.phone.slice(-4)}` : null,
        phoneVerifiedAt: linked && credential ? credential.phoneVerifiedAt.toISOString() : null,
        requiresGoogleReauthentication:
          !session ||
          session.authenticationMethod !== 'GOOGLE' ||
          session.createdAt.getTime() < Date.now() - STEP_UP_MS,
      };
    },

    async challenge(
      purpose: AdminPhonePurpose,
      rawPhone: string,
      ip: string,
      actor?: AdminPrincipal,
    ) {
      const phone = normaliseIndianMobile(rawPhone);
      if (!phone) throw refused();
      if (!this.widget().enabled) throw unavailable();
      try {
        const counter = await cache.increment(`admin-otp:ip:${hashToken(ip)}`, 600);
        if (counter.count > 40)
          throw new RateLimitError(
            'Please wait before requesting another code.',
            counter.retryAfterSeconds,
          );
      } catch (error) {
        if (error instanceof RateLimitError) throw error;
        throw unavailable();
      }
      const browserToken = randomBytes(32).toString('base64url');
      return prisma.$transaction(async (tx) => {
        let credential: AdminPhoneCredential | null;
        if (purpose === 'ENROLL') {
          if (!actor) throw refused();
          await stepUp(tx, actor);
          credential = await lockCredential(tx, actor.userId);
          if (credential && !credential.revokedAt)
            throw new ConflictError(
              'ADMIN_PHONE_ALREADY_LINKED',
              'Revoke the existing mobile credential before linking another number.',
            );
        } else {
          credential = await tx.adminPhoneCredential.findUnique({ where: { phone } });
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-otp:${phone}`}, 0))`;
        const recent = await tx.adminOtpChallenge.findMany({
          where: { phone, createdAt: { gt: new Date(Date.now() - 600_000) } },
          orderBy: { createdAt: 'desc' },
        });
        const latest = recent[0];
        if (latest && latest.createdAt.getTime() > Date.now() - 60_000)
          throw new RateLimitError('Please wait before requesting another code.', 60);
        if (recent.length >= 5)
          throw new RateLimitError('Please wait before requesting another code.', 600);
        await tx.adminOtpChallenge.updateMany({
          where: { phone, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        const challenge = await tx.adminOtpChallenge.create({
          data: {
            purpose,
            phone,
            browserTokenHash: hashToken(browserToken),
            expiresAt: new Date(Date.now() + TTL_MS),
            userId: purpose === 'ENROLL' ? (actor?.userId ?? null) : (credential?.userId ?? null),
            sessionId: purpose === 'ENROLL' ? (actor?.sessionId ?? null) : null,
            credentialId: credential?.id ?? null,
            credentialVersion: credential?.version ?? null,
          },
        });
        return {
          challengeId: challenge.id,
          browserToken,
          expiresAt: challenge.expiresAt.toISOString(),
          resendAfterSeconds: 60,
        };
      });
    },

    async verify(
      purpose: AdminPhonePurpose,
      input: AdminPhoneVerifyInput,
      actor?: AdminPrincipal,
      oldAdminToken?: string,
    ) {
      const challenge = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "admin_otp_challenges" WHERE "id" = ${input.challengeId}::uuid FOR UPDATE`;
        const row = await tx.adminOtpChallenge.findUnique({ where: { id: input.challengeId } });
        if (
          !row ||
          row.purpose !== purpose ||
          row.browserTokenHash !== hashToken(input.browserToken) ||
          row.consumedAt ||
          row.expiresAt.getTime() <= Date.now() ||
          row.attempts >= 5 ||
          (purpose === 'ENROLL' &&
            (row.userId !== actor?.userId || row.sessionId !== actor?.sessionId))
        )
          throw refused();
        await tx.adminOtpChallenge.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 } },
        });
        return row;
      });
      try {
        await proof.prove({
          phone: challenge.phone,
          accessToken: input.accessToken,
          purpose: purpose === 'LOGIN' ? 'ADMIN_LOGIN' : 'ADMIN_ENROLL',
          freshAfter: challenge.createdAt,
        });
        return await prisma.$transaction(async (tx) => {
          if (!challenge.userId) throw refused();
          if (purpose === 'ENROLL') {
            if (!actor) throw refused();
            await stepUp(tx, actor);
          } else await admitted(tx, challenge.userId);
          const credential = await lockCredential(tx, challenge.userId);
          await tx.$queryRaw`SELECT "id" FROM "admin_otp_challenges" WHERE "id" = ${challenge.id}::uuid FOR UPDATE`;
          const current = await tx.adminOtpChallenge.findUniqueOrThrow({
            where: { id: challenge.id },
          });
          if (current.consumedAt || current.expiresAt.getTime() <= Date.now()) throw refused();
          if (
            purpose === 'LOGIN' &&
            (!credential ||
              credential.revokedAt ||
              credential.phone !== challenge.phone ||
              credential.id !== challenge.credentialId ||
              credential.version !== challenge.credentialVersion)
          )
            throw refused();
          if (
            purpose === 'ENROLL' &&
            ((credential && !credential.revokedAt) ||
              (credential?.version ?? null) !== challenge.credentialVersion)
          )
            throw refused();
          await tx.adminOtpRedemption.create({
            data: {
              tokenHash: createHash('sha256').update(input.accessToken).digest('hex'),
              challengeId: challenge.id,
            },
          });
          await tx.adminOtpChallenge.update({
            where: { id: challenge.id },
            data: { consumedAt: new Date() },
          });
          if (purpose === 'ENROLL') {
            const linked = await tx.adminPhoneCredential.upsert({
              where: { userId: challenge.userId },
              create: {
                userId: challenge.userId,
                phone: challenge.phone,
                phoneVerifiedAt: new Date(),
              },
              update: {
                phone: challenge.phone,
                phoneVerifiedAt: new Date(),
                revokedAt: null,
                version: { increment: 1 },
              },
            });
            await audit.record(tx, {
              actorType: 'ADMIN',
              actorId: challenge.userId,
              action: 'admin.phone.enrolled',
              entityType: 'AdminPhoneCredential',
              entityId: linked.id,
              after: { version: linked.version },
            });
            return null;
          }
          if (oldAdminToken)
            await tx.session.updateMany({
              where: { tokenHash: hashToken(oldAdminToken), scope: 'ADMIN', revokedAt: null },
              data: { revokedAt: new Date() },
            });
          const session = await sessions.issue(
            { userId: challenge.userId, scope: 'ADMIN', authenticationMethod: 'PHONE_OTP' },
            tx,
          );
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: challenge.userId,
            action: 'admin.phone.login',
            entityType: 'AdminPhoneCredential',
            entityId: credential?.id ?? challenge.id,
          });
          return session;
        });
      } catch (error) {
        await audit.recordDetached({
          actorType: 'SYSTEM',
          action: 'admin.phone.verification.refused',
          entityType: 'AdminOtpChallenge',
          entityId: challenge.id,
        });
        if (error instanceof UpstreamUnavailableError) throw error;
        if (error instanceof ForbiddenError && error.code === 'ADMIN_GOOGLE_REAUTH_REQUIRED')
          throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code !== 'P2002')
          throw error;
        throw refused();
      }
    },

    async revoke(actor: AdminPrincipal) {
      await prisma.$transaction(async (tx) => {
        await stepUp(tx, actor);
        const credential = await lockCredential(tx, actor.userId);
        if (!credential || credential.revokedAt) throw refused();
        await tx.adminPhoneCredential.update({
          where: { id: credential.id },
          data: { revokedAt: new Date(), version: { increment: 1 } },
        });
        await tx.adminOtpChallenge.updateMany({
          where: { userId: actor.userId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        await tx.session.updateMany({
          where: { userId: actor.userId, scope: 'ADMIN', revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: actor.userId,
          action: 'admin.phone.revoked',
          entityType: 'AdminPhoneCredential',
          entityId: credential.id,
          after: { sessionsRevoked: true },
        });
      });
    },
  };
}
export type AdminPhoneService = ReturnType<typeof createAdminPhoneService>;
function refused() {
  return new ForbiddenError(REFUSED, { code: 'ADMIN_PHONE_VERIFICATION_FAILED' });
}
function unavailable() {
  return new UpstreamUnavailableError('Mobile verification is unavailable. Continue with Google.', {
    code: 'PHONE_OTP_UNAVAILABLE',
  });
}
