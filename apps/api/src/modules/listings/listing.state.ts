import type { Listing, ListingStatus, WithdrawalReason } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { enqueueOutbox, type DomainEventType } from '../../platform/events/bus.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, DomainError, ForbiddenError } from '../../platform/errors.js';
import {
  LISTING_STATE_CHANGED,
  REASON_REQUIRED,
  TRANSITION_REFUSALS,
  WITHDRAWAL_REASON_REQUIRED,
} from './listings.messages.js';

export type ListingEvent =
  | 'submit'
  | 'resubmit'
  | 'requestChanges'
  | 'reject'
  | 'approve'
  | 'reserve'
  | 'reactivate'
  | 'markSold'
  | 'withdraw'
  | 'relist';

export type ListingActorType = 'DEALER' | 'ADMIN' | 'SALES';

export interface ListingActor {
  type: ListingActorType;
  id: string;
  memberId?: string | null;
}

export const LISTING_DOMAIN_EVENTS: Partial<Record<ListingEvent, DomainEventType>> = {
  submit: 'ListingSubmitted',
  resubmit: 'ListingSubmitted',
  approve: 'ListingApproved',
  reject: 'ListingRejected',
  requestChanges: 'ListingChangesRequested',
};

export interface TransitionRule {
  from: readonly ListingStatus[];
  to: ListingStatus;
  actors: readonly ListingActorType[];
  action: string;
  needsReason: boolean;
}

export const LISTING_TRANSITIONS: Record<ListingEvent, TransitionRule> = {
  submit: {
    from: ['DRAFT'],
    to: 'PENDING_REVIEW',
    actors: ['DEALER', 'SALES'],
    action: 'listing.submitted',
    needsReason: false,
  },
  resubmit: {
    from: ['CHANGES_REQUESTED'],
    to: 'PENDING_REVIEW',
    actors: ['DEALER', 'SALES'],
    action: 'listing.resubmitted',
    needsReason: false,
  },
  requestChanges: {
    from: ['PENDING_REVIEW'],
    to: 'CHANGES_REQUESTED',
    actors: ['ADMIN'],
    action: 'listing.changes_requested',
    needsReason: true,
  },
  reject: {
    from: ['PENDING_REVIEW'],
    to: 'REJECTED',
    actors: ['ADMIN'],
    action: 'listing.rejected',
    needsReason: true,
  },
  approve: {
    from: ['PENDING_REVIEW'],
    to: 'ACTIVE',
    actors: ['ADMIN'],
    action: 'listing.approved',
    needsReason: false,
  },
  reserve: {
    from: ['ACTIVE'],
    to: 'RESERVED',
    actors: ['DEALER'],
    action: 'listing.reserved',
    needsReason: false,
  },
  reactivate: {
    from: ['RESERVED'],
    to: 'ACTIVE',
    actors: ['ADMIN'],
    action: 'listing.reactivated',
    needsReason: false,
  },
  markSold: {
    from: ['ACTIVE', 'RESERVED'],
    to: 'SOLD',
    actors: ['DEALER'],
    action: 'listing.marked_sold',
    needsReason: false,
  },
  withdraw: {
    from: ['ACTIVE'],
    to: 'WITHDRAWN',
    actors: ['DEALER', 'ADMIN'],
    action: 'listing.withdrawn',
    needsReason: false,
  },
  relist: {
    from: ['WITHDRAWN'],
    to: 'ACTIVE',
    actors: ['ADMIN'],
    action: 'listing.relisted',
    needsReason: false,
  },
};

export const RELEASING_STATUSES: readonly ListingStatus[] = ['REJECTED', 'SOLD'];

export const REACTIVATION_SOURCES: readonly ListingStatus[] = ['RESERVED', 'WITHDRAWN'];

export function nextStatus(
  status: ListingStatus,
  event: ListingEvent,
  actor: ListingActorType,
): ListingStatus | null {
  const rule = LISTING_TRANSITIONS[event];
  if (!rule.actors.includes(actor)) return null;
  return rule.from.includes(status) ? rule.to : null;
}

export function assertTransition(
  status: ListingStatus,
  event: ListingEvent,
  actor: ListingActorType,
): ListingStatus {
  const rule = LISTING_TRANSITIONS[event];
  if (!rule.actors.includes(actor)) {
    throw new ForbiddenError('That decision is not yours to make.', {
      code: 'LISTING_ACTOR_FORBIDDEN',
    });
  }
  const to = nextStatus(status, event, actor);
  if (!to) {
    const refusal = TRANSITION_REFUSALS[event];
    throw new ConflictError(refusal.code, refusal.message, { extra: { listingStatus: status } });
  }
  return to;
}

export interface Withdrawal {
  reason: WithdrawalReason;
  note?: string | null | undefined;
}

function stampsFor(
  listing: Listing,
  event: ListingEvent,
  actor: ListingActor,
  reason: string | null,
  withdrawal: Withdrawal | null,
  now: Date,
) {
  switch (event) {
    case 'submit':
    case 'resubmit':
      return {
        submittedAt: listing.submittedAt ?? now,
        lastSubmittedAt: now,
        submissionCount: listing.submissionCount + 1,
        submittedByMemberId: actor.type === 'SALES' ? (actor.memberId ?? null) : null,
      };
    case 'requestChanges':
    case 'reject':
      return { decisionReason: reason, decidedBy: actor.id, decidedAt: now };
    case 'approve':
      return {
        publishedAt: listing.publishedAt ?? now,
        decisionReason: null,
        decidedBy: actor.id,
        decidedAt: now,
      };
    case 'reserve':
      return { reservedAt: now };
    case 'reactivate':
      return { reservedAt: null };
    case 'markSold':
      return { soldAt: now };
    case 'withdraw':
      return {
        withdrawnAt: now,
        withdrawalReason: withdrawal?.reason ?? null,
        withdrawalNote: withdrawal?.note?.trim() || null,
      };
    case 'relist':
      return { reservedAt: null, withdrawnAt: null, withdrawalReason: null, withdrawalNote: null };
  }
}

export interface TransitionOptions {
  reason?: string | null;
  withdrawal?: Withdrawal | null;
  now?: Date;
}

export async function transition(
  tx: Tx,
  audit: AuditService,
  listing: Listing,
  event: ListingEvent,
  actor: ListingActor,
  options: TransitionOptions = {},
): Promise<Listing> {
  const to = assertTransition(listing.status, event, actor.type);
  const rule = LISTING_TRANSITIONS[event];
  const reason = options.reason?.trim() ?? null;
  if (rule.needsReason && !reason) throw new DomainError('REASON_REQUIRED', REASON_REQUIRED);
  const withdrawal = options.withdrawal ?? null;
  if (event === 'withdraw' && !withdrawal) {
    throw new DomainError('WITHDRAWAL_REASON_REQUIRED', WITHDRAWAL_REASON_REQUIRED);
  }

  const now = options.now ?? new Date();
  const moved = await tx.listing.updateMany({
    where: { id: listing.id, status: listing.status },
    data: { status: to, ...stampsFor(listing, event, actor, reason, withdrawal, now) },
  });
  if (moved.count === 0) throw new ConflictError('LISTING_STATE_CHANGED', LISTING_STATE_CHANGED);

  if (to === 'PENDING_REVIEW') {
    await tx.listingCheck.deleteMany({ where: { listingId: listing.id } });
  }

  if (REACTIVATION_SOURCES.includes(listing.status)) {
    await tx.listingReactivationRequest.updateMany({
      where: { listingId: listing.id, status: 'PENDING' },
      data: { status: 'CANCELLED', reviewedAt: now },
    });
  }

  if (RELEASING_STATUSES.includes(to)) {
    await tx.vehicle.update({ where: { id: listing.vehicleId }, data: { releasedAt: now } });
  }

  await audit.record(tx, {
    actorType: actor.type,
    actorId: actor.id,
    dealerId: listing.dealerId,
    action: rule.action,
    entityType: 'Listing',
    entityId: listing.id,
    before: { status: listing.status },
    after: {
      status: to,
      vehicleId: listing.vehicleId,
      ...(actor.type === 'SALES' && actor.memberId ? { assistedByMemberId: actor.memberId } : {}),
      ...(reason ? { reason } : {}),
      ...(withdrawal
        ? { withdrawalReason: withdrawal.reason, hasNote: Boolean(withdrawal.note?.trim()) }
        : {}),
    },
  });

  const domainEvent = LISTING_DOMAIN_EVENTS[event];
  if (domainEvent) {
    await enqueueOutbox(tx, {
      type: domainEvent,
      aggregateType: 'Listing',
      aggregateId: listing.id,
      dealerId: listing.dealerId,
      actor: { type: actor.type, id: actor.id },
      traceId: getContext()?.traceId ?? `listing-${event}`,
      payload: {
        listingId: listing.id,
        vehicleId: listing.vehicleId,
        from: listing.status,
        to,
        resubmitted: event === 'resubmit',
        ...(reason ? { reason } : {}),
      },
    });
  }

  return tx.listing.findUniqueOrThrow({ where: { id: listing.id } });
}
