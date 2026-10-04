import { isListingPubliclyVisible } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import { PUBLIC_DEALER_STATUS } from '../search/search.facade.js';

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
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
        include: {
          attachment: {
            include: {
              vehicle: {
                include: { listing: { include: { dealer: { select: { status: true } } } } },
              },
            },
          },
        },
      });
      if (!media || media.status !== 'READY') return null;
      const listing = media.attachment?.vehicle.listing;
      if (
        media.ownerType === 'VEHICLE' &&
        !(
          listing &&
          isListingPubliclyVisible(listing.status) &&
          listing.dealer.status === PUBLIC_DEALER_STATUS
        )
      ) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma types a Json column as JsonValue
      const variants = media.variants as Record<string, string>;
      const key =
        variants[String(width)] ??
        variants['1600'] ??
        variants['1024'] ??
        variants['640'] ??
        media.storageKey;

      const body = await storage.get(key);
      if (!body) return null;
      return { body, contentType: key.endsWith('.webp') ? 'image/webp' : media.mimeType };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;

export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' {
  if (status === 'READY') return 'READY';
  if (status === 'PENDING') return 'PROCESSING';
  return 'FAILED';
}
