import type { MediaOwner, PrismaClient } from '@prisma/client';

import type { EventBus } from '../../platform/events/bus.js';
import { isRecord } from '../../platform/errors.js';
import type { Queue } from '../../platform/jobs/queue.js';
import { variantKey, variantMap } from '../../platform/media/keys.js';
import { deleteStorageObjects } from '../../platform/storage/cleanup.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  recordMediaProcessing,
  type MediaProcessingOutcome,
} from '../../platform/telemetry/metrics.js';
import { hasEveryVariant, renderVariants, type RenderedImage } from './media.variants.js';

export const PROCESSABLE_OWNERS: readonly MediaOwner[] = [
  'VEHICLE',
  'DEALER_PORTFOLIO',
  'DEALER_COVER',
];

export interface ProcessOptions {
  force?: boolean;
}

export interface MediaProcessorDeps {
  prisma: PrismaClient;
  storage: StoragePort;
}

function mediaIdOf(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.mediaId === 'string' && value.mediaId.length > 0 ? value.mediaId : null;
}

export function createMediaProcessor({ prisma, storage }: MediaProcessorDeps) {
  function finish(mediaId: string, outcome: MediaProcessingOutcome): MediaProcessingOutcome {
    recordMediaProcessing(outcome);
    logger.info({ mediaId, outcome }, 'media processing finished');
    return outcome;
  }

  async function write(
    storageKey: string,
    rendered: RenderedImage,
  ): Promise<{ variants: Record<string, string>; keys: string[] }> {
    const byWidth = new Map<number, string>();
    const variants: Record<string, string> = {};
    for (const variant of rendered.variants) {
      let key = byWidth.get(variant.width);
      if (!key) {
        key = variantKey(storageKey, variant.width);
        await storage.put(key, variant.body, 'image/webp');
        byWidth.set(variant.width, key);
      }
      variants[String(variant.requested)] = key;
    }
    return { variants, keys: [...byWidth.values()] };
  }

  async function processMedia(
    mediaId: string,
    options: ProcessOptions = {},
  ): Promise<MediaProcessingOutcome> {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.status !== 'READY' || !PROCESSABLE_OWNERS.includes(media.ownerType)) {
      return finish(mediaId, 'skipped');
    }
    if (!options.force && hasEveryVariant(variantMap(media.variants))) {
      return finish(mediaId, 'skipped');
    }

    const original = await storage.get(media.storageKey);
    if (!original) {
      logger.warn({ mediaId, key: media.storageKey }, 'media original missing from storage');
      return finish(mediaId, 'missing');
    }

    let rendered: RenderedImage;
    try {
      rendered = await renderVariants(original);
    } catch (error) {
      logger.error({ err: error, mediaId }, 'media variants could not be rendered');
      return finish(mediaId, 'unreadable');
    }

    const { variants, keys } = await write(media.storageKey, rendered);
    const updated = await prisma.media.updateMany({
      where: { id: media.id, status: 'READY', storageKey: media.storageKey },
      data: {
        variants,
        width: media.width ?? rendered.width,
        height: media.height ?? rendered.height,
      },
    });
    if (updated.count === 0) {
      await deleteStorageObjects(storage, keys);
      return finish(mediaId, 'superseded');
    }
    return finish(mediaId, 'processed');
  }

  return {
    process: processMedia,

    async unprocessed(options: { all?: boolean } = {}): Promise<string[]> {
      const rows = await prisma.media.findMany({
        where: {
          status: 'READY',
          ownerType: { in: [...PROCESSABLE_OWNERS] },
          ...(options.all ? {} : { variants: { equals: {} } }),
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((row) => row.id);
    },

    subscribe(bus: EventBus, queue: Queue): void {
      bus.on(
        'MediaUploaded',
        async (event) => {
          const mediaId = mediaIdOf(event.payload);
          if (!mediaId) throw new Error('Invalid MediaUploaded payload');
          await queue.send('media.process', { mediaId });
        },
        { required: true },
      );
    },

    async work(queue: Queue): Promise<void> {
      await queue.work('media.process', async (data) => {
        const mediaId = mediaIdOf(data);
        if (!mediaId) {
          logger.warn({ job: 'media.process' }, 'media.process job without a media id');
          return;
        }
        await processMedia(mediaId);
      });
    },
  };
}

export type MediaProcessor = ReturnType<typeof createMediaProcessor>;
