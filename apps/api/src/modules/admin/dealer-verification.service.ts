import {
  DEALER_VERIFICATION_LABELS,
  DEALER_VERIFICATION_TRANSITIONS,
  DealerVerificationAssessment,
  DealerVerificationStatus,
  type DealerVerificationDecisionInput,
  type DealerVerificationReview,
} from '@dealers-drive/contracts';
import { z } from 'zod';

import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import {
  ADMIN_MEMBERSHIP_LOCK,
  isAdmitted,
  isSeatSuspended,
  permissionsForMember,
  type AdminPrincipal,
} from '../auth/auth.facade.js';
import { documentKey } from '../dealers/dealers.facade.js';
import type { AdminDeps } from './admin.service.js';

const ACTION = 'dealer.verification.decided';
const HistoryPayload = z.object({
  status: DealerVerificationStatus,
  reason: z.string().nullable().optional(),
  assessment: DealerVerificationAssessment.nullable().optional(),
});

async function currentReviewer(tx: Tx, admin: AdminPrincipal): Promise<void> {
  if (!admin.permissions.includes('admin:dealer:approve'))
    throw new ForbiddenError('Only authorized dealership reviewers can decide verification.');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADMIN_MEMBERSHIP_LOCK}))`;
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${admin.userId}::uuid FOR SHARE`;
  const actor = await tx.user.findUnique({
    where: { id: admin.userId },
    include: { roles: true, adminMember: true },
  });
  if (
    !actor ||
    !isAdmitted({ email: actor.email, status: actor.status, member: actor.adminMember }) ||
    isSeatSuspended(actor.roles, 'ADMIN') ||
    !actor.adminMember ||
    !permissionsForMember(actor.adminMember.role).includes('admin:dealer:approve')
  )
    throw new ForbiddenError('Your dealership review access is no longer available.');
}

export function createDealerVerificationService({
  prisma,
  audit,
  storage,
}: Pick<AdminDeps, 'prisma' | 'audit' | 'storage'>) {
  async function read(tx: Tx, dealerId: string): Promise<DealerVerificationReview> {
    const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) throw new NotFoundError('That dealership does not exist.');
    const events = await tx.auditLog.findMany({
      where: { entityType: 'Dealer', entityId: dealerId, action: ACTION },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const history: DealerVerificationReview['history'] = [];
    for (const event of events) {
      const before = HistoryPayload.safeParse(event.before);
      const after = HistoryPayload.safeParse(event.after);
      if (before.success && after.success)
        history.push({
          id: String(event.id),
          at: event.createdAt.toISOString(),
          actorId: event.actorId,
          from: before.data.status,
          to: after.data.status,
          reason: after.data.reason ?? null,
          assessment: after.data.assessment ?? null,
        });
    }
    return {
      dealerId,
      status: dealer.verificationStatus,
      statusLabel: DEALER_VERIFICATION_LABELS[dealer.verificationStatus],
      version: dealer.verificationVersion,
      verifiedAt: dealer.verificationVerifiedAt?.toISOString() ?? null,
      reviewerId: dealer.verificationReviewerId,
      transitions: [...DEALER_VERIFICATION_TRANSITIONS[dealer.verificationStatus]],
      history,
    };
  }
  return {
    async review(admin: AdminPrincipal, dealerId: string): Promise<DealerVerificationReview> {
      return withTransaction(prisma, async (tx) => {
        await currentReviewer(tx, admin);
        return read(tx, dealerId);
      });
    },
    async decide(
      admin: AdminPrincipal,
      dealerId: string,
      input: DealerVerificationDecisionInput,
    ): Promise<DealerVerificationReview> {
      return withTransaction(prisma, async (tx) => {
        await currentReviewer(tx, admin);
        await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id"=${dealerId}::uuid FOR UPDATE`;
        const dealer = await tx.dealer.findUnique({
          where: { id: dealerId },
          include: {
            assistedBy: true,
            members: { where: { status: 'ACTIVE' }, include: { user: true } },
          },
        });
        if (!dealer) throw new NotFoundError('That dealership does not exist.');
        if (
          dealer.assistedBy?.userId === admin.userId ||
          dealer.members.some((member) => member.userId === admin.userId)
        )
          throw new ForbiddenError('Another authorized reviewer must verify this dealership.', {
            code: 'SELF_REVIEW_FORBIDDEN',
          });
        if (dealer.verificationVersion !== input.expectedVersion)
          throw new ConflictError(
            'VERIFICATION_CHANGED',
            'Verification changed. Reload before deciding.',
          );
        if (!DEALER_VERIFICATION_TRANSITIONS[dealer.verificationStatus].includes(input.status))
          throw new ConflictError(
            'VERIFICATION_TRANSITION',
            'That verification transition is not allowed.',
          );
        if (input.status === 'VERIFIED') {
          if (dealer.status !== 'ACTIVE')
            throw new DomainError(
              'DEALER_NOT_APPROVED',
              'Approve the dealership separately before granting its verified badge.',
            );
          if (!input.assessment)
            throw new DomainError(
              'VERIFICATION_EVIDENCE_REQUIRED',
              'Record all performed verification checks.',
            );
          if (
            input.assessment.businessType === 'REGISTERED_VEHICLE_DEALER' &&
            input.assessment.regulatoryOutcome !== 'CHECKED_VALID'
          )
            throw new DomainError(
              'REGULATORY_AUTHORIZATION_REQUIRED',
              'Record the applicable registered-vehicle dealer authorization check.',
            );
          const owner = dealer.members.find((member) => member.role === 'OWNER')?.user;
          const phoneVerified =
            dealer.onboardingSource === 'ASSISTED'
              ? dealer.contactPhoneVerifiedAt !== null
              : owner?.phoneVerifiedAt != null && owner.phone === dealer.contactPhone;
          const emailVerified =
            dealer.onboardingSource === 'ASSISTED'
              ? dealer.contactEmailVerifiedAt !== null
              : owner?.emailVerifiedAt != null &&
                owner.email?.toLowerCase() === dealer.contactEmail?.toLowerCase();
          if (!dealer.contactPhone || !dealer.contactEmail || !phoneVerified || !emailVerified)
            throw new DomainError(
              'CONTACT_NOT_VERIFIED',
              'Verify the representative contact identities before granting a badge.',
            );
          await tx.$queryRaw`SELECT "id" FROM "dealer_documents" WHERE "dealerId"=${dealerId}::uuid ORDER BY "id" FOR UPDATE`;
          const documents = await tx.dealerDocument.findMany({ where: { dealerId } });
          const required = documents.filter(
            (doc) =>
              doc.type === 'PAN_CARD' ||
              doc.type === 'ADDRESS_PROOF' ||
              (dealer.gstin && doc.type === 'GST_CERTIFICATE'),
          );
          const expected = dealer.gstin ? 3 : 2;
          if (
            required.length !== expected ||
            required.some(
              (doc) =>
                doc.status !== 'VERIFIED' || !doc.fileName || !doc.reviewedBy || !doc.reviewedAt,
            )
          )
            throw new DomainError(
              'VERIFICATION_DOCUMENTS_REQUIRED',
              'Review the applicable uploaded business documents before granting a badge.',
            );
          if (dealer.gstin && input.assessment.gstOutcome !== 'CHECKED_VALID')
            throw new DomainError(
              'GST_VERIFICATION_REQUIRED',
              'A supplied GSTIN needs its applicable registration check.',
            );
          if (!dealer.gstin && input.assessment.gstOutcome !== 'NOT_REQUIRED_REVIEWED')
            throw new DomainError(
              'GST_APPLICABILITY_REQUIRED',
              'Record why GST registration is not required, or collect and verify it.',
            );
          const objects = await Promise.all(
            required.map((doc) => storage.head(documentKey(dealer.slug, doc.type, doc.id))),
          );
          if (objects.some((object) => object === null))
            throw new DomainError(
              'VERIFICATION_DOCUMENT_MISSING',
              'A reviewed evidence upload is missing.',
            );
        }
        const now = new Date();
        await tx.dealer.update({
          where: { id: dealerId },
          data: {
            verificationStatus: input.status,
            verificationVersion: { increment: 1 },
            verificationVerifiedAt: input.status === 'VERIFIED' ? now : null,
            verificationReviewerId: admin.userId,
          },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: ACTION,
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.verificationStatus, version: dealer.verificationVersion },
          after: {
            status: input.status,
            version: dealer.verificationVersion + 1,
            reason: input.reason ?? null,
            assessment: input.assessment ?? null,
            policyVersion: 'dd-business-verification-v1',
          },
        });
        return read(tx, dealerId);
      });
    },
  };
}
