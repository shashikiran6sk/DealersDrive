import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import type { Tx } from '../db/prisma.js';
import { logger } from '../telemetry/logger.js';

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
  | 'DealerChangesRequested'
  | 'DealerProfileChangeSubmitted'
  | 'DealerProfileChangeDecided'
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
      payload: event as unknown as Prisma.InputJsonObject,
    },
  });
}
