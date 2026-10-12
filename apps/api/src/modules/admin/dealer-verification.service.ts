import {
  DEALER_VERIFICATION_LABELS,
  DEALER_VERIFICATION_TRANSITIONS,
  DealerVerificationStatus,
  documentRequirement,
  isVerifiedDocument,
  type DealerVerificationDecisionInput,
  type DealerVerificationReview,
} from '@dealers-drive/contracts';
import type { DealerDocType, DocStatus } from '@prisma/client';
import { z } from 'zod';

import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { type AdminPrincipal } from '../auth/auth.facade.js';
import { assertCurrentAdmin } from './current-admin.js';
import { documentKey } from '../dealers/dealers.facade.js';
import type { AdminDeps } from './admin.service.js';

const ACTION = 'dealer.verification.decided';
const HistoryPayload = z.object({
  status: DealerVerificationStatus,
  reason: z.string().nullable().optional(),
});

async function currentReviewer(tx: Tx, admin: AdminPrincipal): Promise<void> {
  await assertCurrentAdmin(
    tx,
    admin,
    'admin:dealer:approve',
    'Only authorized dealership reviewers can decide verification.',
    'Your dealership review access is no longer available.',
  );
}

type EvidenceDocument = {
  id: string;
  type: DealerDocType;
  status: DocStatus;
  fileName: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

function reviewed(doc: EvidenceDocument): boolean {
  return isVerifiedDocument(doc) && Boolean(doc.reviewedBy) && Boolean(doc.reviewedAt);
}

function requiredEvidence<T extends EvidenceDocument>(documents: T[], gstin: string | null): T[] {
  return documentRequirement(documents, gstin, reviewed).satisfiedBy ?? [];
}

function evidenceFingerprint(slug: string, documents: EvidenceDocument[]): string {
  return [
    slug,
    ...documents
      .map((doc) =>
        [
          doc.id,
          doc.type,
          doc.status,
          doc.fileName,
          doc.reviewedBy,
          doc.reviewedAt?.getTime(),
        ].join(':'),
      )
      .sort(),
  ].join('|');
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
  async function storedEvidenceFingerprint(dealerId: string): Promise<string | null> {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { slug: true, gstin: true, documents: true },
    });
    if (!dealer) return null;
    const required = requiredEvidence(dealer.documents, dealer.gstin);
    const objects = await Promise.all(
      required
        .filter((doc) => doc.status === 'VERIFIED' && doc.fileName)
        .map((doc) => storage.head(documentKey(dealer.slug, doc.type, doc.id))),
    );
    if (objects.some((object) => object === null))
      throw new DomainError(
        'VERIFICATION_DOCUMENT_MISSING',
        'A reviewed evidence upload is missing.',
      );
    return evidenceFingerprint(dealer.slug, required);
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
      if (!admin.permissions.includes('admin:dealer:approve'))
        throw new ForbiddenError('Only authorized dealership reviewers can decide verification.');
      const checkedEvidence =
        input.status === 'VERIFIED' ? await storedEvidenceFingerprint(dealerId) : null;
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
          const required = requiredEvidence(documents, dealer.gstin);
          if (required.length === 0)
            throw new DomainError(
              'VERIFICATION_DOCUMENTS_REQUIRED',
              'Review the applicable uploaded business documents before granting a badge.',
            );
          if (checkedEvidence !== evidenceFingerprint(dealer.slug, required))
            throw new ConflictError(
              'VERIFICATION_CHANGED',
              'Verification evidence changed. Reload before deciding.',
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
            policyVersion: 'dd-business-verification-v2',
          },
        });
        return read(tx, dealerId);
      });
    },
  };
}
