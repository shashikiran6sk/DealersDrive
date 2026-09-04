import { randomUUID } from 'node:crypto';

import type {
  MediaCommitResponse,
  MediaPresignInput,
  PresignResponse,
  VehicleMediaDto,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { Queue } from '../../platform/jobs/queue.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { DomainError, NotFoundError } from '../../platform/errors.js';
import { mediaUrl } from '../../platform/media/urls.js';

/**
 * Presign → the client uploads straight to storage → commit.
 *
 * The API never touches image bytes on the upload path. That is the whole
 * design (§12.1): a 10MB photo would otherwise occupy a request thread for the
 * length of the upload, and twenty of them would occupy twenty.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is 365 lines and carries three features. What is here is
 * F033's half — presign, commit, get, remove and serve. Deferred:
 *
 *   · `process()` — the sharp/blurhash derivative pipeline, **F034**. Nothing
 *     calls it yet; `media.process` is enqueued by `commit()` below and no
 *     handler is registered, so a committed upload stays PENDING until F034.
 *   · `reorder()` — position and the primary photo, **F035**.
 *
 * Every method that reaches `Vehicle` or `VehicleMedia` is also cut back:
 * neither model exists (F055 and F035), and the vehicle half of media is what
 * they add. Each cut is marked where it happens.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface MediaDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  queue: Queue;
}

export function createMediaService({ prisma, storage, queue }: MediaDeps) {
  return {
    /**
     * C14 presign. The API validates the declared mime, size and quota,
     * creates a PENDING `Media` row with `dealerId` **from the session**, and
     * hands back a URL with the content-type and content-length baked into the
     * signature (§12.1).
     *
     * ── Reconstruction slice ──────────────────────────────────────────────
     * The baseline first loads the vehicle and refuses a 21st photo:
     *
     *     if (input.ownerType === 'VEHICLE') { … MAX_PHOTOS_PER_VEHICLE … }
     *
     * `Vehicle` is **F055**. The quota returns with it — and it has to, because
     * nothing else enforces the cap.
     */
    async presign(dealerId: string, input: MediaPresignInput): Promise<PresignResponse> {
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
     *
     * ── Reconstruction slice ──────────────────────────────────────────────
     * The baseline upserts a `VehicleMedia` row here, which is what gives the
     * upload its position. `VehicleMedia` is **F035**; `position` is accepted
     * and echoed back so the contract and the client are unchanged, but nothing
     * is linked until then.
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

    /**
     * The poll the uploader runs until processing reports READY or FAILED.
     *
     * ── Reconstruction slice ──────────────────────────────────────────────
     * The baseline reads `position` off the `VehicleMedia` link and `isPrimary`
     * off `vehicle.primaryMediaId`. Both are **F035**. The defaults below are
     * what the baseline itself answers for an unlinked upload, so the shape a
     * client parses is unchanged.
     */
    async get(dealerId: string, mediaId: string): Promise<VehicleMediaDto> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError('That upload does not exist.');

      return {
        mediaId: media.id,
        position: 0,
        isPrimary: false,
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

    /**
     * ── Reconstruction slice ──────────────────────────────────────────────
     * The baseline does three more things here, all of them about the vehicle
     * this photo belongs to: it refuses the delete when it would drop a **live
     * listing** below `listing.minPhotos`, it removes the `VehicleMedia` link,
     * and it promotes the next photo to primary. Those need `Vehicle`
     * (**F055**), `Listing` (**F064**) and `VehicleMedia` (**F035**).
     *
     * ⚠️ The guard is the one that matters: without it a dealer could empty a
     * live listing's gallery. It must come back with F064, and the
     * `PlatformConfigService` dependency the service drops here comes back
     * with it.
     */
    async remove(dealerId: string, mediaId: string): Promise<void> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError('That upload does not exist.');

      await prisma.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
    },

    /** Resolves a delivery request to stored bytes. Content-addressed, immutable. */
    async serve(
      mediaId: string,
      width: number,
    ): Promise<{ body: Buffer; contentType: string } | null> {
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
