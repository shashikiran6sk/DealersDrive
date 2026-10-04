import type { PrismaClient } from '@prisma/client';
import type { Tx } from '../db/prisma.js';

import { logger } from '../telemetry/logger.js';
import type { DomainEvent, EventBus } from './bus.js';

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

export interface OutboxPublisher {
  start(): void;
  stop(): void | Promise<void>;
  drain(): Promise<number>;
}

export function createOutboxPublisher(prisma: PrismaClient, bus: EventBus): OutboxPublisher {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let inFlight: Promise<void> | undefined;

  async function drain(): Promise<number> {
    return prisma.$transaction((tx) => drainTransaction(tx), { timeout: 20_000 });
  }

  async function drainTransaction(tx: Tx): Promise<number> {
    const rows = await tx.$queryRaw<
      { id: bigint; payload: unknown }[]
    >`SELECT id, payload FROM outbox_events
        WHERE "publishedAt" IS NULL AND attempts < ${MAX_ATTEMPTS}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;

    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the outbox row holds the event as Json
      const event = row.payload as DomainEvent;
      try {
        await bus.publish(event);
        await tx.outboxEvent.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
      } catch (error) {
        logger.error({ err: error, outboxId: String(row.id) }, 'outbox publish failed');
        await tx.outboxEvent.update({
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
      timer = setInterval(() => {
        if (!running) inFlight = tick();
      }, POLL_INTERVAL_MS);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await inFlight;
    },
    drain,
  };
}
