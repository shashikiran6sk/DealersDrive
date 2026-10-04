import { isListingPubliclyVisible } from '@dealers-drive/contracts';
import type { DealerStatus, ListingStatus, MediaOwner, PrismaClient } from '@prisma/client';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import { PUBLIC_DEALER_STATUS } from '../search/search.facade.js';

interface ServableMedia {
  id: string;
  ownerType: MediaOwner;
  attachment: {
    vehicle: { listing: { status: ListingStatus; dealer: { status: DealerStatus } } | null };
  } | null;
}

export interface MediaDeps {
  prisma: PrismaClient;
  storage: StoragePort;
}

export function createMediaService({ prisma, storage }: MediaDeps) {
  async function isPubliclyServable(media: ServableMedia): Promise<boolean> {
    if (media.ownerType === 'VEHICLE') {
      const listing = media.attachment?.vehicle.listing;
      return Boolean(
        listing &&
        isListingPubliclyVisible(listing.status) &&
        listing.dealer.status === PUBLIC_DEALER_STATUS,
      );
    }
    if (media.ownerType === 'DEALER_COVER') {
      const owners = await prisma.dealer.count({
        where: { coverMediaId: media.id, status: PUBLIC_DEALER_STATUS },
      });
      return owners > 0;
    }
    return false;
  }

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
      if (!(await isPubliclyServable(media))) return null;

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
