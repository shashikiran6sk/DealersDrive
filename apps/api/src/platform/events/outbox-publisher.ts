import type { PrismaClient } from '@prisma/client';

import { logger } from '../telemetry/logger.js';
import type { DomainEvent, EventBus } from './bus.js';

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

export interface OutboxPublisher {
  start(): void;
  stop(): void;
  /** Drains the outbox once. Tests call this instead of waiting for the timer. */
  drain(): Promise<number>;
}

/**
 * Reads unpublished outbox rows every two seconds and hands them to the
 * in-process bus. `FOR UPDATE SKIP LOCKED` means several workers can drain the
 * same table without either of them seeing the other's rows.
 *
 * When the sink becomes a broker, this is the only file that changes.
 */
export function createOutboxPublisher(prisma: PrismaClient, bus: EventBus): OutboxPublisher {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function drain(): Promise<number> {
    const rows = await prisma.$queryRaw<
      { id: bigint; payload: unknown }[]
    >`SELECT id, payload FROM outbox_events
        WHERE "publishedAt" IS NULL AND attempts < ${MAX_ATTEMPTS}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;

    for (const row of rows) {
      const event = row.payload as DomainEvent;
      try {
        await bus.publish(event);
        await prisma.outboxEvent.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
      } catch (error) {
        logger.error({ err: error, outboxId: String(row.id) }, 'outbox publish failed');
        await prisma.outboxEvent.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 } },
        });
      }
    }

    return rows.length;
  }

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await drain();
    } catch (error) {
      logger.error({ err: error }, 'outbox drain failed');
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    drain,
  };
}
