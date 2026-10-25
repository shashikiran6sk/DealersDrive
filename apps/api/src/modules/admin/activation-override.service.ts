import {
  DEALER_ACTIVATION_METHOD_LABELS,
  MANUAL_ACTIVATION_DISCLAIMER_VERSION,
  documentRequirement,
  isVerifiedDocument,
  type ActivationOverrideInput,
  type ActivationOverrideResponse,
  type DealerActivationState,
  type DocumentFact,
  type RevokeActivationOverrideInput,
} from '@dealers-drive/contracts';
import type { Dealer, DealerStatus } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import { invalidateDealerVerification } from '../dealers/dealers.facade.js';
import type { AdminDeps } from './admin.service.js';
import {
  DEALER_NOT_FOUND,
  OVERRIDE_ACCESS_REVOKED,
  OVERRIDE_ACCOUNT_INCOMPLETE,
  OVERRIDE_BUSINESS_INCOMPLETE,
  OVERRIDE_DOCUMENT_REJECTED,
  OVERRIDE_FORBIDDEN,
  OVERRIDE_NOT_ACTIVE,
  OVERRIDE_NOT_AWAITING,
  OVERRIDE_REVOKED_VERIFICATION,
  OVERRIDE_SELF_REVIEW,
  OVERRIDE_STANDARD_AVAILABLE,
} from './admin.messages.js';
import { assertCurrentAdmin } from './current-admin.js';

const AWAITING: readonly DealerStatus[] = ['DRAFT', 'PENDING_APPROVAL'];
const WITHDRAWABLE: readonly DealerStatus[] = ['ACTIVE', 'SUSPENDED'];

export interface OverrideFacts {
  status: DealerStatus;
  selfReview: boolean;
  accountComplete: boolean;
  businessComplete: boolean;
  documents: readonly DocumentFact[];
  gstin: string | null;
}

export function overrideBlockReason(facts: OverrideFacts): string | null {
  if (!AWAITING.includes(facts.status)) return OVERRIDE_NOT_AWAITING;
  if (facts.selfReview) return OVERRIDE_SELF_REVIEW;
  if (!facts.accountComplete) return OVERRIDE_ACCOUNT_INCOMPLETE;
  if (!facts.businessComplete) return OVERRIDE_BUSINESS_INCOMPLETE;
  if (facts.documents.some((doc) => doc.status === 'REJECTED')) return OVERRIDE_DOCUMENT_REJECTED;
  if (documentRequirement(facts.documents, facts.gstin, isVerifiedDocument).satisfiedBy) {
    return OVERRIDE_STANDARD_AVAILABLE;
  }
  return null;
}

export function activationState(
  dealer: Pick<
    Dealer,
    'activationMethod' | 'activationOverrideAt' | 'activationOverrideReason' | 'gstin'
  >,
  documents: readonly DocumentFact[],
  overriddenBy: string | null,
): DealerActivationState {
  const manual = dealer.activationMethod === 'MANUAL_OVERRIDE';
  return {
    method: dealer.activationMethod,
    methodLabel: dealer.activationMethod
      ? DEALER_ACTIVATION_METHOD_LABELS[dealer.activationMethod]
      : null,
    overriddenAt: manual ? (dealer.activationOverrideAt?.toISOString() ?? null) : null,
    overriddenBy: manual ? overriddenBy : null,
    justification: manual ? dealer.activationOverrideReason : null,
    outstanding: documentRequirement(documents, dealer.gstin, isVerifiedDocument).gaps,
  };
}

export function createActivationOverrideService({
  prisma,
  audit,
  dealers,
}: Pick<AdminDeps, 'prisma' | 'audit' | 'dealers'>) {
  async function lockedDealer(tx: Tx, dealerId: string) {
    await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
    const dealer = await tx.dealer.findUnique({
      where: { id: dealerId },
      include: {
        assistedBy: { select: { userId: true } },
        members: { where: { status: 'ACTIVE' }, select: { userId: true } },
        documents: true,
      },
    });
    if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
    return dealer;
  }

  async function authorize(tx: Tx, admin: AdminPrincipal) {
    await assertCurrentAdmin(
      tx,
      admin,
      'admin:activation:override',
      OVERRIDE_FORBIDDEN,
      OVERRIDE_ACCESS_REVOKED,
    );
  }

  return {
    async override(
      admin: AdminPrincipal,
      dealerId: string,
      input: ActivationOverrideInput,
    ): Promise<ActivationOverrideResponse> {
      return withTransaction(prisma, async (tx) => {
        await authorize(tx, admin);
        const dealer = await lockedDealer(tx, dealerId);
        const selfReview =
          dealer.assistedBy?.userId === admin.userId ||
          dealer.members.some((member) => member.userId === admin.userId);
        if (selfReview) {
          throw new ForbiddenError(OVERRIDE_SELF_REVIEW, { code: 'SELF_REVIEW_FORBIDDEN' });
        }
        const application = await dealers.completeness(dealerId, tx);
        const blocked = overrideBlockReason({
          status: dealer.status,
          selfReview,
          accountComplete: application.steps[0]?.complete ?? false,
          businessComplete: application.steps[1]?.complete ?? false,
          documents: dealer.documents,
          gstin: dealer.gstin,
        });
        if (blocked) throw new ConflictError('ACTIVATION_OVERRIDE_BLOCKED', blocked);

        const now = new Date();
        const updated = await tx.dealer.update({
          where: { id: dealerId },
          data: {
            status: 'ACTIVE',
            approvedAt: now,
            statusReason: null,
            activationMethod: 'MANUAL_OVERRIDE',
            activationOverrideAt: now,
            activationOverrideById: admin.userId,
            activationOverrideReason: input.justification,
          },
        });
        const state = activationState(updated, dealer.documents, admin.email);

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.activation_overridden',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.status, activationMethod: dealer.activationMethod },
          after: {
            status: 'ACTIVE',
            activationMethod: 'MANUAL_OVERRIDE',
            justification: input.justification,
            disclaimerVersion: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
            outstanding: state.outstanding,
            verificationStatus: dealer.verificationStatus,
          },
        });
        await enqueueOutbox(tx, {
          type: 'DealerApproved',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'dealer-activation-override',
          payload: { dealerId, activationMethod: 'MANUAL_OVERRIDE' },
        });

        return { dealerId, status: updated.status, activation: state };
      });
    },

    async revoke(
      admin: AdminPrincipal,
      dealerId: string,
      input: RevokeActivationOverrideInput,
    ): Promise<ActivationOverrideResponse> {
      return withTransaction(prisma, async (tx) => {
        await authorize(tx, admin);
        const dealer = await lockedDealer(tx, dealerId);
        if (
          dealer.activationMethod !== 'MANUAL_OVERRIDE' ||
          !WITHDRAWABLE.includes(dealer.status)
        ) {
          throw new ConflictError('ACTIVATION_OVERRIDE_NOT_ACTIVE', OVERRIDE_NOT_ACTIVE);
        }

        const updated = await tx.dealer.update({
          where: { id: dealerId },
          data: {
            status: 'PENDING_APPROVAL',
            approvedAt: null,
            statusReason: input.reason,
            activationMethod: null,
          },
        });
        await invalidateDealerVerification(
          tx,
          audit,
          dealer,
          { actorType: 'ADMIN', actorId: admin.userId },
          OVERRIDE_REVOKED_VERIFICATION,
        );
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.activation_override_revoked',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.status, activationMethod: 'MANUAL_OVERRIDE' },
          after: { status: 'PENDING_APPROVAL', reason: input.reason },
        });

        return {
          dealerId,
          status: updated.status,
          activation: activationState(updated, dealer.documents, null),
        };
      });
    },
  };
}
