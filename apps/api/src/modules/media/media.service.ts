import { randomUUID } from 'node:crypto';

import { slugify, type MediaCommitResponse, type MediaPresignInput, type PresignResponse, type ReorderMediaInput, type VehicleMediaDto } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';
import { encode } from 'blurhash';
import sharp from 'sharp';

import { env } from '../../config/env.js';
import type { Queue } from '../../platform/jobs/queue.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { mediaUrl } from '../../platform/media/urls.js';

export interface MediaDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  queue: Queue;
  config: PlatformConfigService;
}

const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const;
const MAX_PHOTOS_PER_VEHICLE = 20;

export function createMediaService({ prisma, storage, queue, config }: MediaDeps) {
  return {
    /**
     * C14 presign. The API never touches image bytes on the upload path — it
     * validates the declared mime, size and quota, creates a PENDING `Media`
     * row with `dealerId` **from the session**, and hands back a URL with the
     * content-type and content-length baked into the signature (§12.1).
     */
    async presign(dealerId: string, input: MediaPresignInput): Promise<PresignResponse> {
      if (input.ownerType === 'VEHICLE') {
        const vehicle = await prisma.vehicle.findFirst({
          where: { id: input.ownerId, dealerId, deletedAt: null },
          include: { media: true },
        });
        if (!vehicle) throw new NotFoundError('That vehicle does not exist.');
        if (vehicle.media.length >= MAX_PHOTOS_PER_VEHICLE) {
          throw new DomainError(
            'TOO_MANY_PHOTOS',
            `A vehicle can carry at most ${MAX_PHOTOS_PER_VEHICLE} photos.`,
          );
        }
      }

      const mediaId = randomUUID();
      const key = `vehicles/${input.ownerId}/${mediaId}/original`;

      await prisma.media.create({
        data: {
          id: mediaId,
          dealerId,
          ownerType: input.ownerType,
          storageKey: key,
          mimeType: input.mimeType,
          bytes: input.bytes,
          width: input.width ?? null,
          height: input.height ?? null,
          fileName: input.fileName,
          status: 'PENDING',
        },
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });

      return {
        mediaId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
        maxBytes: 10 * 1024 * 1024,
      };
    },

    /**
     * Commit. HEADs the object and verifies that what landed matches what was
     * presigned, then enqueues processing. Never trust `Content-Type` — the
     * worker checks magic bytes and fully re-encodes (§12.2).
     */
    async commit(
      dealerId: string,
      mediaId: string,
      position?: number,
    ): Promise<MediaCommitResponse> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError('That upload does not exist.');

      const object = await storage.head(media.storageKey);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }
      if (object.bytes !== media.bytes) {
        await prisma.media.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
        throw new DomainError(
          'UPLOAD_MISMATCH',
          'The uploaded file does not match what was declared.',
        );
      }

      const vehicleId = media.storageKey.split('/')[1];
      if (media.ownerType === 'VEHICLE' && vehicleId) {
        const existing = await prisma.vehicleMedia.count({ where: { vehicleId } });
        await prisma.vehicleMedia.upsert({
          where: { vehicleId_mediaId: { vehicleId, mediaId } },
          create: { vehicleId, mediaId, position: position ?? existing },
          update: { position: position ?? existing },
        });
      }

      await queue.send('media.process', { mediaId });

      const refreshed = await prisma.media.findUnique({ where: { id: mediaId } });

      return {
        mediaId,
        status: refreshed?.status === 'READY' ? 'READY' : 'PROCESSING',
        position: position ?? 0,
        poll: `/v1/dealer/media/${mediaId}`,
        estimatedSeconds: 6,
      };
    },

    async get(dealerId: string, mediaId: string): Promise<VehicleMediaDto> {
      const media = await prisma.media.findFirst({
        where: { id: mediaId, dealerId },
        include: { vehicles: true },
      });
      if (!media) throw new NotFoundError('That upload does not exist.');

      const link = media.vehicles[0];
      const vehicle = link
        ? await prisma.vehicle.findUnique({ where: { id: link.vehicleId } })
        : null;

      return {
        mediaId: media.id,
        position: link?.position ?? 0,
        isPrimary: vehicle?.primaryMediaId === media.id,
        status: toMediaStatus(media.status),
        url: media.status === 'READY' ? mediaUrl(media.id, 1024) : null,
        blurhash: media.blurhash,
        width: media.width,
        height: media.height,
        fileName: media.fileName,
        warnings: media.warnings,
        uploadedByAdmin: media.uploadedByAdmin,
      };
    },

    /** The full ordered array, always — no partial-swap bugs (§12.2). */
    async reorder(dealerId: string, vehicleId: string, input: ReorderMediaInput) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, dealerId, deletedAt: null },
        include: { media: true },
      });
      if (!vehicle) throw new NotFoundError('That vehicle does not exist.');

      const owned = new Set(vehicle.media.map((entry) => entry.mediaId));
      for (const mediaId of input.mediaIds) {
        if (!owned.has(mediaId)) {
          throw new NotFoundError('One of those photos does not belong to this vehicle.');
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const [position, mediaId] of input.mediaIds.entries()) {
          await tx.vehicleMedia.update({
            where: { vehicleId_mediaId: { vehicleId, mediaId } },
            data: { position },
          });
        }
        // Position 0 is the primary image buyers see in results, denormalized
        // onto the vehicle so cards need no join (§12.2).
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { primaryMediaId: input.mediaIds[0] ?? null },
        });
      });

      return {
        media: input.mediaIds.map((mediaId, position) => ({
          mediaId,
          position,
          isPrimary: position === 0,
        })),
      };
    },

    async remove(dealerId: string, mediaId: string): Promise<void> {
      const media = await prisma.media.findFirst({
        where: { id: mediaId, dealerId },
        include: { vehicles: true },
      });
      if (!media) throw new NotFoundError('That upload does not exist.');

      const link = media.vehicles[0];
      if (link) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: link.vehicleId },
          include: { listings: { orderBy: { submittedAt: 'desc' }, take: 1 } },
        });
        const listing = vehicle?.listings[0];
        const minPhotos = await config.number('listing.minPhotos');
        const remaining = await prisma.vehicleMedia.count({
          where: { vehicleId: link.vehicleId, media: { status: 'READY' } },
        });

        if (listing?.status === 'APPROVED' && remaining - 1 < minPhotos) {
          throw new ConflictError(
            'BELOW_MINIMUM_PHOTOS',
            `A live listing needs at least ${minPhotos} photos.`,
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.vehicleMedia.deleteMany({ where: { mediaId } });
        await tx.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
        if (link) {
          const next = await tx.vehicleMedia.findFirst({
            where: { vehicleId: link.vehicleId },
            orderBy: { position: 'asc' },
          });
          await tx.vehicle.update({
            where: { id: link.vehicleId },
            data: { primaryMediaId: next?.mediaId ?? null },
          });
        }
      });
    },

    /**
     * The processing job. Verifies magic bytes against the declared mime,
     * **fully re-decodes** rather than transforming in place — the only
     * reliable defence against polyglot files — auto-orients from EXIF and
     * then strips all of it, because the GPS coordinates of a dealer's yard
     * are PII (§12.1).
     */
    async process(mediaId: string): Promise<void> {
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (!media) return;

      const original = await storage.get(media.storageKey);
      if (!original) {
        // The bytes were committed but the worker cannot see them. In practice
        // that means the worker is reading a *different* store from the one the
        // upload landed in — a second process on the queue with its own
        // STORAGE_DRIVER. Silent here once cost an afternoon; it never should.
        logger.warn(
          { mediaId, key: media.storageKey, driver: env.STORAGE_DRIVER },
          'media bytes missing from storage — nothing to process',
        );
        await prisma.media.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
        return;
      }

      try {
        const probe = sharp(original, { failOn: 'error' });
        const metadata = await probe.metadata();

        if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
          await prisma.media.update({
            where: { id: mediaId },
            data: { status: 'FAILED', warnings: ['UNSUPPORTED_FORMAT'] },
          });
          logger.warn({ mediaId, format: metadata.format }, 'media magic bytes rejected');
          return;
        }

        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;

        const variants: Record<string, string> = {};
        for (const target of DERIVATIVE_WIDTHS) {
          if (target > width && target !== DERIVATIVE_WIDTHS[0]) continue; // never upscale
          const body = await sharp(original)
            .rotate() // auto-orient from EXIF…
            .resize({ width: target, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer(); // …and re-encode, which drops every EXIF tag with it
          const key = `${media.storageKey.replace(/\/original$/, '')}/${target}.webp`;
          await storage.put(key, body, 'image/webp');
          variants[String(target)] = key;
        }

        const { data, info } = await sharp(original)
          .resize(32, 24, { fit: 'fill' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);

        const warnings: string[] = [];
        if (width > 0 && width < 800) warnings.push('TOO_SMALL');
        if (height > 0 && (width / height > 2.2 || width / height < 0.6)) {
          warnings.push('EXTREME_ASPECT');
        }

        await prisma.media.update({
          where: { id: mediaId },
          data: {
            status: 'READY',
            width,
            height,
            blurhash,
            variants,
            warnings,
            fileName: media.fileName ?? `${slugify(mediaId)}.webp`,
          },
        });
      } catch (error) {
        logger.error({ err: error, mediaId }, 'media processing failed');
        await prisma.media.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
      }
    },

    /** Resolves a delivery request to stored bytes. Content-addressed, immutable. */
    async serve(mediaId: string, width: number): Promise<{ body: Buffer; contentType: string } | null> {
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (!media || media.status !== 'READY') return null;

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

/**
 * `ORPHAN` is a storage-lifecycle state, not something a dealer can act on —
 * the contract exposes four states and a deleted upload reads as FAILED.
 */
export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' {
  if (status === 'READY') return 'READY';
  if (status === 'PENDING') return 'PROCESSING';
  return 'FAILED';
}
