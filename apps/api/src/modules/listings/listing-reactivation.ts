import type { Listing, ListingReactivationRequest } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, errorCode } from '../../platform/errors.js';
import { REACTIVATION_SOURCES, transition, type ListingActor } from './listing.state.js';
import {
  REACTIVATION_ALREADY_PENDING,
  REACTIVATION_NOT_ALLOWED,
  REACTIVATION_NOT_PENDING,
  REACTIVATION_STALE,
} from './listings.messages.js';

export type ReactivationDecision = 'approve' | 'reject';

function alreadyPending(): ConflictError {
  return new ConflictError('REACTIVATION_ALREADY_PENDING', REACTIVATION_ALREADY_PENDING);
}

function notPending(request: ListingReactivationRequest): ConflictError {
  return new ConflictError('REACTIVATION_NOT_PENDING', REACTIVATION_NOT_PENDING, {
    extra: { requestStatus: request.status },
  });
}

function trimmed(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export async function fileReactivationRequest(
  tx: Tx,
  audit: AuditService,
  listing: Listing,
  actor: ListingActor,
  reason?: string | null,
): Promise<ListingReactivationRequest> {
  if (!REACTIVATION_SOURCES.includes(listing.status)) {
    throw new ConflictError(REACTIVATION_NOT_ALLOWED.code, REACTIVATION_NOT_ALLOWED.message, {
      extra: { listingStatus: listing.status },
    });
  }

  const pending = await tx.listingReactivationRequest.findFirst({
    where: { listingId: listing.id, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) throw alreadyPending();

  const note = trimmed(reason);
  let request: ListingReactivationRequest;
  try {
    request = await tx.listingReactivationRequest.create({
      data: {
        listingId: listing.id,
        dealerId: listing.dealerId,
        fromStatus: listing.status,
        reason: note,
        requestedBy: actor.id,
      },
    });
  } catch (error) {
    if (errorCode(error) === 'P2002') throw alreadyPending();
    throw error;
  }

  await audit.record(tx, {
    actorType: actor.type,
    actorId: actor.id,
    dealerId: listing.dealerId,
    action: 'listing.reactivation_requested',
    entityType: 'Listing',
    entityId: listing.id,
    before: { status: listing.status },
    after: { status: listing.status, requestId: request.id, ...(note ? { reason: note } : {}) },
  });
  await enqueueOutbox(tx, {
    type: 'ListingReactivationRequested',
    aggregateType: 'ListingReactivationRequest',
    aggregateId: request.id,
    dealerId: listing.dealerId,
    actor: { type: actor.type, id: actor.id },
    traceId: getContext()?.traceId ?? 'listing-reactivation-requested',
    payload: {
      requestId: request.id,
      listingId: listing.id,
      fromStatus: listing.status,
      ...(note ? { reason: note } : {}),
    },
  });

  return request;
}

export async function decideReactivationRequest(
  tx: Tx,
  audit: AuditService,
  request: ListingReactivationRequest,
  listing: Listing,
  decision: ReactivationDecision,
  actor: ListingActor,
  adminNote?: string | null,
  now: Date = new Date(),
): Promise<Listing> {
  if (request.status !== 'PENDING') throw notPending(request);
  if (decision === 'approve' && listing.status !== request.fromStatus) {
    throw new ConflictError('REACTIVATION_STALE', REACTIVATION_STALE, {
      extra: { listingStatus: listing.status, fromStatus: request.fromStatus },
    });
  }

  const note = trimmed(adminNote);
  const decided = await tx.listingReactivationRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: {
      status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedBy: actor.id,
      reviewedAt: now,
      adminNote: note,
    },
  });
  if (decided.count === 0) throw notPending(request);

  let result = listing;
  if (decision === 'approve') {
    if (request.fromStatus === 'WITHDRAWN') {
      const vehicle = await tx.vehicle.findUniqueOrThrow({
        where: { id: listing.vehicleId },
        select: { releasedAt: true },
      });
      if (vehicle.releasedAt) {
        await tx.vehicle.update({ where: { id: listing.vehicleId }, data: { releasedAt: null } });
      }
    }
    const event = request.fromStatus === 'RESERVED' ? 'reactivate' : 'relist';
    result = await transition(tx, audit, listing, event, actor, { now });
  }

  await audit.record(tx, {
    actorType: actor.type,
    actorId: actor.id,
    dealerId: listing.dealerId,
    action:
      decision === 'approve' ? 'listing.reactivation_approved' : 'listing.reactivation_rejected',
    entityType: 'Listing',
    entityId: listing.id,
    before: { status: listing.status },
    after: { status: result.status, requestId: request.id, ...(note ? { reason: note } : {}) },
  });
  await enqueueOutbox(tx, {
    type: 'ListingReactivationDecided',
    aggregateType: 'ListingReactivationRequest',
    aggregateId: request.id,
    dealerId: listing.dealerId,
    actor: { type: actor.type, id: actor.id },
    traceId: getContext()?.traceId ?? 'listing-reactivation-decided',
    payload: {
      requestId: request.id,
      listingId: listing.id,
      approved: decision === 'approve',
      ...(note ? { reason: note } : {}),
    },
  });

  return result;
}
