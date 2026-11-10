import type { MediaOwner, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { isRecord } from '../../platform/errors.js';
import type { EventBus } from '../../platform/events/bus.js';
import type { Queue } from '../../platform/jobs/queue.js';
import { DERIVATIVE_TYPE, deriveImages, type DerivedImage } from '../../platform/media/derive.js';
import { deleteStorageObjects } from '../../platform/storage/cleanup.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { logger } from '../../platform/telemetry/logger.js';

export const PROCESSED_OWNERS: readonly MediaOwner[] = [
  'VEHICLE',
  'DEALER_PORTFOLIO',
  'DEALER_COVER',
];

export type ProcessOutcome = 'processed' | 'skipped' | 'unreadable';

const MediaJob = z.object({ mediaId: z.uuid() });

export function hasVariants(variants: unknown): boolean {
  return isRecord(variants) && Object.keys(variants).length > 0;
}

export interface MediaProcessorDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  queue: Queue;
}

export function createMediaProcessor({ prisma, storage, queue }: MediaProcessorDeps) {
  async function process(mediaId: string): Promise<ProcessOutcome> {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, ownerType: true, storageKey: true, status: true, variants: true },
    });
    if (
      !media ||
      media.status !== 'READY' ||
      !PROCESSED_OWNERS.includes(media.ownerType) ||
      hasVariants(media.variants)
    ) {
      return 'skipped';
    }

    const body = await storage.get(media.storageKey);
    if (!body) {
      logger.warn({ mediaId }, 'media.process_missing_original');
      return 'unreadable';
    }

    let derived: DerivedImage;
    try {
      derived = await deriveImages(media.storageKey, body);
    } catch (error) {
      logger.warn({ err: error, mediaId }, 'media.process_undecodable');
      return 'unreadable';
    }

    for (const derivative of derived.derivatives) {
      await storage.put(derivative.key, derivative.body, DERIVATIVE_TYPE);
    }
    const variants = Object.fromEntries(
      derived.derivatives.map((derivative) => [String(derivative.width), derivative.key]),
    );

    const saved = await prisma.media.updateMany({
      where: { id: media.id, status: 'READY' },
      data: { variants, width: derived.width, height: derived.height },
    });
    if (saved.count === 0) {
      await deleteStorageObjects(storage, Object.values(variants));
      return 'skipped';
    }
    return 'processed';
  }

  return {
    process,

    subscribe(bus: EventBus): void {
      bus.on(
        'MediaUploaded',
        async (event) => {
          const job = MediaJob.safeParse(event.payload);
          if (!job.success) throw new Error('Invalid MediaUploaded payload');
          await queue.send('media.process', { mediaId: job.data.mediaId });
        },
        { required: true },
      );
    },

    async work(): Promise<void> {
      await queue.work('media.process', async (data) => {
        const job = MediaJob.safeParse(data);
        if (!job.success) {
          logger.warn({ data }, 'media.process_invalid_job');
          return;
        }
        await process(job.data.mediaId);
      });
    },
  };
}

export type MediaProcessor = ReturnType<typeof createMediaProcessor>;
