import { isListingPubliclyVisible } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import { writeDerivatives } from '../../platform/media/derivatives.js';
import { DERIVATIVE_WIDTHS } from '../../platform/media/urls.js';

export interface MediaDeps {
  prisma: PrismaClient;
  storage: StoragePort;
}

export function createMediaService({ prisma, storage }: MediaDeps) {
  return {
    async serve(
      mediaId: string,
      width: number,
    ): Promise<{ body: Buffer; contentType: string } | null> {
      if (!DERIVATIVE_WIDTHS.some((candidate) => candidate === width)) return null;
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
        include: { attachment: { include: { vehicle: { include: { listing: true } } } } },
      });
      if (!media || media.status !== 'READY') return null;
      if (!['VEHICLE', 'DEALER_COVER'].includes(media.ownerType)) return null;
      const dealer = media.dealerId
        ? await prisma.dealer.findUnique({
            where: { id: media.dealerId },
            select: { status: true, coverMediaId: true },
          })
        : null;
      if (!dealer || dealer.status !== 'ACTIVE') return null;
      if (media.ownerType === 'DEALER_COVER' && dealer.coverMediaId !== media.id) return null;
      const listingStatus = media.attachment?.vehicle.listing?.status;
      if (
        media.ownerType === 'VEHICLE' &&
        !(listingStatus && isListingPubliclyVisible(listingStatus))
      ) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma types a Json column as JsonValue
      let variants = media.variants as Record<string, string>;
      if (!variants[String(width)]) {
        const original = await storage.get(media.storageKey);
        if (!original) return null;
        variants = await writeDerivatives(media.id, original, storage);
        await prisma.media.update({ where: { id: media.id }, data: { variants } });
      }
      const key = variants[String(width)];
      if (!key) return null;

      const body = await storage.get(key);
      if (!body) return null;
      return { body, contentType: 'image/webp' };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;

export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' {
  if (status === 'READY') return 'READY';
  if (status === 'PENDING') return 'PROCESSING';
  return 'FAILED';
}
