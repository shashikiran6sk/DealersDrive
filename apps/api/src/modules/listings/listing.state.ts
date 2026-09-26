import type { Listing, ListingStatus } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, DomainError, ForbiddenError } from '../../platform/errors.js';
import {
  LISTING_STATE_CHANGED,
  REASON_REQUIRED,
  TRANSITION_REFUSALS,
} from './listings.messages.js';

export type ListingEvent =
  'submit' | 'resubmit' | 'requestChanges' | 'reject' | 'approve' | 'markSold' | 'remove';

export type ListingActorType = 'DEALER' | 'ADMIN';

export interface ListingActor {
  type: ListingActorType;
  id: string;
}

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
    actors: ['DEALER'],
    action: 'listing.submitted',
    needsReason: false,
  },
  resubmit: {
    from: ['CHANGES_REQUESTED'],
    to: 'PENDING_REVIEW',
    actors: ['DEALER'],
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
  markSold: {
    from: ['ACTIVE'],
    to: 'SOLD',
    actors: ['DEALER'],
    action: 'listing.marked_sold',
    needsReason: false,
  },
  remove: {
    from: ['ACTIVE'],
    to: 'REMOVED',
    actors: ['DEALER', 'ADMIN'],
    action: 'listing.removed',
    needsReason: false,
  },
};

export const RELEASING_STATUSES: readonly ListingStatus[] = ['REJECTED', 'SOLD', 'REMOVED'];

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

function stampsFor(
  listing: Listing,
  to: ListingStatus,
  actor: ListingActor,
  reason: string | null,
  now: Date,
) {
  switch (to) {
    case 'PENDING_REVIEW':
      return {
        submittedAt: listing.submittedAt ?? now,
        lastSubmittedAt: now,
        submissionCount: listing.submissionCount + 1,
      };
    case 'CHANGES_REQUESTED':
    case 'REJECTED':
      return { decisionReason: reason, decidedBy: actor.id, decidedAt: now };
    case 'ACTIVE':
      return {
        publishedAt: listing.publishedAt ?? now,
        decisionReason: null,
        decidedBy: actor.id,
        decidedAt: now,
      };
    case 'SOLD':
      return { soldAt: now };
    case 'REMOVED':
      return { removedAt: now };
    case 'DRAFT':
      return {};
  }
}

export interface TransitionOptions {
  reason?: string | null;
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

  const now = options.now ?? new Date();
  const moved = await tx.listing.updateMany({
    where: { id: listing.id, status: listing.status },
    data: { status: to, ...stampsFor(listing, to, actor, reason, now) },
  });
  if (moved.count === 0) throw new ConflictError('LISTING_STATE_CHANGED', LISTING_STATE_CHANGED);

  if (to === 'PENDING_REVIEW') {
    await tx.listingCheck.deleteMany({ where: { listingId: listing.id } });
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
    after: { status: to, vehicleId: listing.vehicleId, ...(reason ? { reason } : {}) },
  });

  return tx.listing.findUniqueOrThrow({ where: { id: listing.id } });
}
