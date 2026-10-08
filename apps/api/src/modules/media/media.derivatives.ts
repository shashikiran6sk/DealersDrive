import { z } from 'zod';
import sharp from 'sharp';
import type { PrismaClient } from '@prisma/client';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import { DERIVATIVE_WIDTHS } from '../../platform/media/urls.js';
import { sniffImageType } from '../../platform/media/sniff.js';
import { logger } from '../../platform/telemetry/logger.js';

export function createVehicleDerivativeWorker(prisma: PrismaClient, storage: StoragePort) {
  return async function process(mediaId?: string): Promise<void> {
    const orphaned = await prisma.media.findMany({
      where: { ownerType: 'VEHICLE', status: 'ORPHAN', NOT: { variants: { equals: {} } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const row of orphaned) {
      const parsed = z.record(z.string(), z.string()).safeParse(row.variants);
      if (!parsed.success) continue;
      try {
        for (const key of Object.values(parsed.data).filter((value) =>
          value.startsWith(`vehicles/derivatives/${row.id}/`),
        ))
          await storage.delete(key);
        await prisma.media.updateMany({
          where: { id: row.id, status: 'ORPHAN' },
          data: { variants: {} },
        });
      } catch {
        logger.warn(
          { event: 'media.derivatives.cleanup_failed' },
          'vehicle derivative cleanup retained for retry',
        );
      }
    }
    const rows = await prisma.media.findMany({
      where: {
        ownerType: 'VEHICLE',
        uploadedByAdmin: true,
        ...(mediaId ? { id: mediaId } : {}),
        status: 'READY',
        OR: [{ derivativesRetryAt: null }, { derivativesRetryAt: { lte: new Date() } }],
        variants: { equals: {} },
        attachment: {
          vehicle: { listing: { status: { in: ['PENDING_REVIEW', 'ACTIVE', 'RESERVED'] } } },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const row of rows) {
      try {
        const body = await storage.get(row.storageKey);
        if (
          !body ||
          body.length > 12 * 1024 * 1024 ||
          body.length !== row.bytes ||
          sniffImageType(body) !== row.mimeType
        )
          throw new Error('Source bytes unavailable, invalid or oversized.');
        const image = sharp(body, { limitInputPixels: 16_000_000, animated: false });
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
          throw new Error('Unsupported image dimensions.');
        const variants: Record<string, string> = {};
        for (const width of DERIVATIVE_WIDTHS) {
          const key = `vehicles/derivatives/${row.id}/${width}.webp`;
          const bytes = await sharp(body, { limitInputPixels: 16_000_000, animated: false })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          await storage.put(key, bytes, 'image/webp');
          variants[String(width)] = key;
        }
        const updated = await prisma.media.updateMany({
          where: { id: row.id, status: 'READY', variants: { equals: {} } },
          data: {
            variants: z.record(z.string(), z.string()).parse(variants),
            width: metadata.width,
            height: metadata.height,
            derivativesRetryAt: null,
          },
        });
        if (updated.count === 0)
          await prisma.media.updateMany({
            where: { id: row.id, status: 'ORPHAN' },
            data: { variants },
          });
      } catch {
        await prisma.media.updateMany({
          where: { id: row.id, status: 'READY', variants: { equals: {} } },
          data: { derivativesRetryAt: new Date(Date.now() + 15 * 60_000) },
        });
        logger.warn(
          { event: 'media.derivatives.failed' },
          'approved vehicle derivative processing failed; original retained for retry',
        );
      }
    }
  };
}
