import { createHash } from 'node:crypto';

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

export interface LocatedImage {
  key: string;
  contentType: string;
  etag: string;
}

export function imageEtag(mediaId: string, key: string): string {
  const digest = createHash('sha256').update(`${mediaId}:${key}`).digest('base64url');
  return `"m1-${digest.slice(0, 32)}"`;
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

  async function locate(mediaId: string, width: number): Promise<LocatedImage | null> {
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

    return {
      key,
      contentType: key.endsWith('.webp') ? 'image/webp' : media.mimeType,
      etag: imageEtag(media.id, key),
    };
  }

  return {
    locate,

    read(image: LocatedImage): Promise<Buffer | null> {
      return storage.get(image.key);
    },

    async serve(
      mediaId: string,
      width: number,
    ): Promise<{ body: Buffer; contentType: string } | null> {
      const image = await locate(mediaId, width);
      if (!image) return null;
      const body = await storage.get(image.key);
      if (!body) return null;
      return { body, contentType: image.contentType };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;

export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' {
  if (status === 'READY') return 'READY';
  if (status === 'PENDING') return 'PROCESSING';
  return 'FAILED';
}
