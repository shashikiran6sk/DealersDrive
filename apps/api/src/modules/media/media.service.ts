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
import { UPLOAD_INCOMPLETE, UPLOAD_NOT_FOUND } from '../../platform/messages.js';

export interface MediaDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  queue: Queue;
}

export function createMediaService({ prisma, storage, queue }: MediaDeps) {
  return {
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

    async commit(
      dealerId: string,
      mediaId: string,
      position?: number,
    ): Promise<MediaCommitResponse> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError(UPLOAD_NOT_FOUND);

      const object = await storage.head(media.storageKey);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
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

    async get(dealerId: string, mediaId: string): Promise<VehicleMediaDto> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError(UPLOAD_NOT_FOUND);

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

    async remove(dealerId: string, mediaId: string): Promise<void> {
      const media = await prisma.media.findFirst({ where: { id: mediaId, dealerId } });
      if (!media) throw new NotFoundError(UPLOAD_NOT_FOUND);

      await prisma.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
    },

    async serve(
      mediaId: string,
      width: number,
    ): Promise<{ body: Buffer; contentType: string } | null> {
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (!media || media.status !== 'READY') return null;

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
