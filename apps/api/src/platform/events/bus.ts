import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import type { Tx } from '../db/prisma.js';
import { logger } from '../telemetry/logger.js';

/**
 * The event envelope. Fixing this now is cheap; changing it after forty
 * side-effecting flows is not (ARCHITECTURE §19.2).
 */
export interface DomainEvent<T = unknown> {
  id: string;
  type: DomainEventType;
  version: 1;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  dealerId?: string;
  actor: { type: 'DEALER' | 'ADMIN' | 'SYSTEM'; id?: string };
  traceId: string;
  payload: T;
}

export type DomainEventType =
  | 'DealerApproved'
  | 'DealerRejected'
  | 'DealerSuspended'
  | 'DealerReinstated'
  | 'DealerApplied'
  | 'VehicleCreated'
  | 'VehicleUpdated'
  | 'VehicleSold'
  | 'ListingSubmitted'
  | 'ListingApproved'
  | 'ListingRejected'
  | 'ListingChangesRequested'
  | 'ListingExpired'
  | 'ListingRemoved'
  | 'MediaUploaded'
  | 'MediaProcessed'
  | 'EnquiryCreated'
  | 'PhoneRevealed'
  | 'CreditsPurchased'
  | 'PhotoRequested'
  | 'PhotoRequestScheduled'
  | 'PhotoRequestCompleted';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventBus {
  on(type: DomainEventType, handler: EventHandler): void;
  /** Publishes to every subscriber. A failing subscriber never rolls the caller back. */
  publish(event: DomainEvent): Promise<void>;
}

export function createEventBus(): EventBus {
  const handlers = new Map<DomainEventType, EventHandler[]>();

  return {
    on(type, handler) {
      const existing = handlers.get(type) ?? [];
      existing.push(handler);
      handlers.set(type, existing);
    },

    async publish(event) {
      const subscribers = handlers.get(event.type) ?? [];
      for (const handler of subscribers) {
        try {
          await handler(event);
        } catch (error) {
          // Rule: a subscriber never throws into the publisher.
          logger.error(
            { err: error, eventType: event.type, eventId: event.id },
            'event subscriber failed',
          );
        }
      }
    },
  };
}

export interface OutboxWrite {
  type: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  dealerId?: string;
  actor: DomainEvent['actor'];
  traceId: string;
  payload: Record<string, unknown>;
}

/**
 * Writes the event into the outbox **inside the caller's transaction**.
 *
 * Without this, "save the listing, then send the email" has two failure modes:
 * an email for a listing that rolled back, or a listing saved with no email.
 * One table, and it makes the side effect exactly as durable as the state
 * change that caused it.
 *
 * Payloads carry ids, never PII — the handler re-fetches.
 */
export async function enqueueOutbox(tx: Tx, write: OutboxWrite): Promise<void> {
  const event: DomainEvent<Record<string, unknown>> = {
    id: randomUUID(),
    type: write.type,
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: write.aggregateType,
    aggregateId: write.aggregateId,
    ...(write.dealerId === undefined ? {} : { dealerId: write.dealerId }),
    actor: write.actor,
    traceId: write.traceId,
    payload: write.payload,
  };

  await tx.outboxEvent.create({
    data: {
      aggregateType: write.aggregateType,
      aggregateId: write.aggregateId,
      eventType: write.type,
      // Prisma's `InputJsonValue` demands an index signature, which a named
      // interface does not have even when every field in it is serialisable.
      // The cast is the assertion that this event is JSON — it is, by
      // construction — and not a widening of the type.
      payload: event as unknown as Prisma.InputJsonObject,
    },
  });
}
