import type {
  ClaimDealerInput,
  ClaimDealerResponse,
  DealerClaimPreview,
  DealerClaimState,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  ensureSeat,
  type IdentityService,
  type PhoneProofService,
  type SessionService,
} from '../auth/auth.facade.js';
import { CLAIM_LINK_TTL_MS, claimTokenHash, claimUrl, mintClaimToken } from './claim-token.js';
import {
  CLAIM_ACCOUNT_HAS_DEALERSHIP,
  CLAIM_ACCOUNT_UNAVAILABLE,
  CLAIM_ALREADY_OWNED,
  CLAIM_DEALERSHIP_CLOSED,
  CLAIM_EMAIL_FIRST,
  CLAIM_LINK_EXPIRED,
  CLAIM_LINK_INVALID,
  CLAIM_LINK_SUPERSEDED,
  CLAIM_PHONE_MISMATCH,
  CLAIM_STAFF_ACCOUNT,
} from './dealer-claims.messages.js';
import { maskEmail, maskPhone } from './masking.js';

export interface DealerClaimsDeps {
  prisma: PrismaClient;
  audit: AuditService;
  sessions: Pick<SessionService, 'issue'>;
  proof: Pick<PhoneProofService, 'prove'>;
  identities: Pick<IdentityService, 'findByVerifiedPhone' | 'createWithPhone'>;
}

export interface ClaimLink {
  email: string;
  name: string | null;
  dealerName: string;
  url: string;
  expiresAt: Date;
}

export interface ClaimContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface ClaimResult extends ClaimDealerResponse {
  token: string;
  expiresAt: Date;
}

const CLOSED_STATUSES = new Set(['REJECTED', 'CLOSED']);

const CLAIM_RETURN_TO = '/dealer';

const VERIFICATION_SELECT = {
  id: true,
  dealerId: true,
  email: true,
  expiresAt: true,
  verifiedAt: true,
  claimedAt: true,
  supersededAt: true,
  dealer: {
    select: {
      legalName: true,
      brandName: true,
      city: true,
      district: true,
      status: true,
      contactEmail: true,
      contactPhone: true,
      onboardingSource: true,
      assistedBy: { select: { user: { select: { fullName: true } } } },
      members: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { id: true } },
    },
  },
} as const;

function invalid(): NotFoundError {
  return new NotFoundError(CLAIM_LINK_INVALID, { code: 'CLAIM_LINK_INVALID' });
}

export function createDealerClaimsService({
  prisma,
  audit,
  sessions,
  proof,
  identities,
}: DealerClaimsDeps) {
  async function find(token: string) {
    const row = await prisma.dealerEmailVerification.findUnique({
      where: { tokenHash: claimTokenHash(token) },
      select: VERIFICATION_SELECT,
    });
    if (!row || row.dealer.onboardingSource !== 'ASSISTED') throw invalid();
    return row;
  }

  type Row = Awaited<ReturnType<typeof find>>;

  function stateOf(row: Row, now = Date.now()): DealerClaimState {
    if (row.claimedAt || row.dealer.members.length > 0) return 'CLAIMED';
    if (row.supersededAt || row.email !== row.dealer.contactEmail?.toLowerCase()) {
      return 'SUPERSEDED';
    }
    if (!row.expiresAt || row.expiresAt.getTime() <= now) return 'EXPIRED';
    return row.verifiedAt ? 'AWAITING_CLAIM' : 'AWAITING_EMAIL';
  }

  function assertUsable(state: DealerClaimState): void {
    if (state === 'EXPIRED') {
      throw new ConflictError('CLAIM_LINK_EXPIRED', CLAIM_LINK_EXPIRED);
    }
    if (state === 'SUPERSEDED') {
      throw new ConflictError('CLAIM_LINK_SUPERSEDED', CLAIM_LINK_SUPERSEDED);
    }
    if (state === 'CLAIMED') {
      throw new ConflictError('CLAIM_ALREADY_OWNED', CLAIM_ALREADY_OWNED);
    }
  }

  async function preview(token: string): Promise<DealerClaimPreview> {
    const row = await find(token);
    const phone = row.dealer.contactPhone ?? '';
    return {
      state: stateOf(row),
      dealerName: row.dealer.brandName || row.dealer.legalName,
      city: row.dealer.city,
      district: row.dealer.district,
      emailMasked: maskEmail(row.email),
      phoneMasked: maskPhone(phone),
      phoneLast4: phone.slice(-4),
      assistedBy: row.dealer.assistedBy?.user.fullName ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  return {
    async issueLink(verificationId: string): Promise<ClaimLink | null> {
      const row = await prisma.dealerEmailVerification.findUnique({
        where: { id: verificationId },
        select: {
          email: true,
          supersededAt: true,
          claimedAt: true,
          dealer: { select: { legalName: true, brandName: true, contactName: true } },
        },
      });
      if (!row || row.supersededAt || row.claimedAt) return null;

      const token = mintClaimToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CLAIM_LINK_TTL_MS);
      await prisma.dealerEmailVerification.update({
        where: { id: verificationId },
        data: { tokenHash: claimTokenHash(token), sentAt: now, expiresAt },
      });

      return {
        email: row.email,
        name: row.dealer.contactName,
        dealerName: row.dealer.brandName || row.dealer.legalName,
        url: claimUrl(env.WEB_BASE_URL, token),
        expiresAt,
      };
    },

    preview,

    async verifyEmail(token: string): Promise<DealerClaimPreview> {
      const row = await find(token);
      const state = stateOf(row);
      assertUsable(state);

      if (state === 'AWAITING_EMAIL') {
        const now = new Date();
        await withTransaction(prisma, async (tx) => {
          await tx.dealerEmailVerification.update({
            where: { id: row.id },
            data: { verifiedAt: now },
          });
          await tx.dealer.update({
            where: { id: row.dealerId },
            data: { contactEmailVerifiedAt: now },
          });
          await audit.record(tx, {
            actorType: 'SYSTEM',
            dealerId: row.dealerId,
            action: 'dealer.assisted.email_verified',
            entityType: 'Dealer',
            entityId: row.dealerId,
            after: { verificationId: row.id, verifiedAt: now.toISOString() },
          });
        });
        logger.info(
          { event: 'dealer.claim.email_verified', dealerId: row.dealerId },
          'assisted dealership email verified',
        );
      }

      return preview(token);
    },

    async claim(
      token: string,
      input: ClaimDealerInput,
      context: ClaimContext = {},
    ): Promise<ClaimResult> {
      const row = await find(token);
      const state = stateOf(row);
      assertUsable(state);
      if (state !== 'AWAITING_CLAIM') {
        throw new ConflictError('CLAIM_EMAIL_FIRST', CLAIM_EMAIL_FIRST);
      }
      if (CLOSED_STATUSES.has(row.dealer.status)) {
        throw new ConflictError('CLAIM_DEALERSHIP_CLOSED', CLAIM_DEALERSHIP_CLOSED);
      }

      const proven = await proof.prove({
        phone: input.phone,
        accessToken: input.accessToken,
        purpose: 'DEALER_CLAIM',
        ip: context.ip,
      });
      if (proven.phone !== row.dealer.contactPhone) {
        throw new ForbiddenError(CLAIM_PHONE_MISMATCH, {
          code: 'CLAIM_PHONE_MISMATCH',
          errors: [
            { field: 'body.phone', code: 'CLAIM_PHONE_MISMATCH', message: CLAIM_PHONE_MISMATCH },
          ],
        });
      }

      const existing = await identities.findByVerifiedPhone(proven.phone);
      if (existing) await assertMayOwn(existing.id);
      const userId = existing
        ? existing.id
        : (await identities.createWithPhone(proven, { fullName: null })).userId;

      const membershipId = await withTransaction(prisma, async (tx) => {
        const [locked] = await tx.$queryRaw<
          { claimedAt: Date | null; supersededAt: Date | null }[]
        >`
          SELECT "claimedAt", "supersededAt" FROM "dealer_email_verifications"
          WHERE "id" = ${row.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${row.dealerId}::uuid FOR UPDATE`;
        if (!locked || locked.supersededAt) {
          throw new ConflictError('CLAIM_LINK_SUPERSEDED', CLAIM_LINK_SUPERSEDED);
        }
        if (locked.claimedAt) throw new ConflictError('CLAIM_ALREADY_OWNED', CLAIM_ALREADY_OWNED);

        const owner = await tx.dealerMember.findFirst({
          where: { dealerId: row.dealerId, role: 'OWNER', status: 'ACTIVE' },
          select: { id: true },
        });
        if (owner) throw new ConflictError('CLAIM_ALREADY_OWNED', CLAIM_ALREADY_OWNED);

        const elsewhere = await tx.dealerMember.findFirst({
          where: { userId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (elsewhere) {
          throw new ConflictError('CLAIM_ACCOUNT_HAS_DEALERSHIP', CLAIM_ACCOUNT_HAS_DEALERSHIP);
        }

        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { fullName: true },
        });
        if (!user.fullName) {
          const contact = await tx.dealer.findUniqueOrThrow({
            where: { id: row.dealerId },
            select: { contactName: true },
          });
          if (contact.contactName) {
            await tx.user.update({
              where: { id: userId },
              data: { fullName: contact.contactName },
            });
          }
        }

        const member = await tx.dealerMember.upsert({
          where: { dealerId_userId: { dealerId: row.dealerId, userId } },
          update: { role: 'OWNER', status: 'ACTIVE', permissions: [] },
          create: { dealerId: row.dealerId, userId, role: 'OWNER', permissions: [] },
          select: { id: true },
        });
        const now = new Date();
        await tx.dealerEmailVerification.update({
          where: { id: row.id },
          data: { claimedAt: now, claimedByUserId: userId },
        });
        await ensureSeat(tx, { userId, role: 'DEALER' });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: userId,
          dealerId: row.dealerId,
          action: 'dealer.claimed',
          entityType: 'Dealer',
          entityId: row.dealerId,
          after: {
            ownerUserId: userId,
            verificationId: row.id,
            proof: ['EMAIL_LINK', 'PHONE_OTP'],
            accountCreated: existing === null,
          },
        });
        return member.id;
      });

      const session = await sessions.issue({
        userId,
        scope: 'DEALER',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      logger.info(
        { event: 'dealer.claimed', dealerId: row.dealerId, membershipId },
        'assisted dealership claimed by its owner',
      );

      return {
        dealerId: row.dealerId,
        returnTo: CLAIM_RETURN_TO,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    },
  };

  async function assertMayOwn(userId: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        status: true,
        isPlatformAdmin: true,
        adminMember: { select: { status: true } },
        roles: { select: { role: true, status: true } },
      },
    });
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError(CLAIM_ACCOUNT_UNAVAILABLE, { code: 'CLAIM_ACCOUNT_UNAVAILABLE' });
    }
    const staff =
      user.isPlatformAdmin ||
      user.adminMember !== null ||
      user.roles.some((seat) => seat.role === 'ADMIN');
    if (staff) throw new ForbiddenError(CLAIM_STAFF_ACCOUNT, { code: 'CLAIM_STAFF_ACCOUNT' });
    if (user.roles.some((seat) => seat.role === 'DEALER' && seat.status === 'SUSPENDED')) {
      throw new ForbiddenError(CLAIM_ACCOUNT_UNAVAILABLE, { code: 'CLAIM_ACCOUNT_UNAVAILABLE' });
    }
  }
}

export type DealerClaimsService = ReturnType<typeof createDealerClaimsService>;
