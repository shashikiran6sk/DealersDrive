import { randomUUID } from 'node:crypto';

import type {
  PresignResponse,
  StorefrontMediaPresignInput,
  StorefrontMediaReceipt,
} from '@dealers-drive/contracts';
import { STOREFRONT_MEDIA_MAX_BYTES } from '@dealers-drive/contracts';
import sharp, { type Metadata } from 'sharp';
import { z } from 'zod';

import { DomainError, NotFoundError } from '../../platform/errors.js';
import { sniffImageType, IMAGE_EXTENSIONS } from '../../platform/media/sniff.js';
import { DERIVATIVE_WIDTHS } from '../../platform/media/urls.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { DealerWriteActor } from '../auth/auth.facade.js';
import type { StorefrontService } from './storefront.service.js';

export function createStorefrontMedia(storage: StoragePort, storefront: StorefrontService) {
  return {
    async image(
      actor: DealerWriteActor,
      mediaId: string,
      width: number,
    ): Promise<{ body: Buffer; mimeType: string }> {
      const media = await storefront.read(actor, async (tx) => {
        const row = await tx.media.findFirst({
          where: {
            id: mediaId,
            dealerId: actor.dealerId,
            status: 'READY',
            ownerType: { in: ['DEALER_COVER', 'DEALER_LOGO'] },
          },
        });
        if (!row) throw new NotFoundError('This branding image is unavailable.');
        return row;
      });
      const variants = z.record(z.string(), z.string()).parse(media.variants);
      const key = variants[String(width)] ?? media.storageKey;
      const body = await storage.get(key);
      if (!body) throw new NotFoundError('This branding image is unavailable.');
      return { body, mimeType: key.endsWith('.webp') ? 'image/webp' : media.mimeType };
    },
    async presign(
      actor: DealerWriteActor,
      input: StorefrontMediaPresignInput,
    ): Promise<PresignResponse> {
      const media = await storefront.write(actor, async (tx) => {
        await storefront.rowOf(tx, actor.dealerId);
        const id = randomUUID();
        return tx.media.create({
          data: {
            id,
            dealerId: actor.dealerId,
            ownerType: 'DEALER_COVER',
            storageKey: `storefront/${actor.dealerId}/${id}/original.${IMAGE_EXTENSIONS[input.mimeType]}`,
            mimeType: input.mimeType,
            bytes: input.bytes,
            fileName: input.fileName,
            warnings: [],
          },
        });
      });
      const upload = await storage.presignPut({
        key: media.storageKey,
        contentType: media.mimeType,
        contentLength: media.bytes,
      });
      return { mediaId: media.id, ...upload, maxBytes: media.bytes };
    },

    async commit(actor: DealerWriteActor, mediaId: string): Promise<StorefrontMediaReceipt> {
      const media = await storefront.write(actor, async (tx) => {
        const row = await tx.media.findFirst({
          where: { id: mediaId, dealerId: actor.dealerId, ownerType: 'DEALER_COVER' },
        });
        if (
          !row ||
          !row.storageKey.startsWith(`storefront/${actor.dealerId}/${mediaId}/`) ||
          !['PENDING', 'READY'].includes(row.status)
        )
          throw new NotFoundError('This branding upload is unavailable.');
        return row;
      });
      if (media.status === 'READY') return { mediaId };
      const object = await storage.head(media.storageKey);
      if (!object || object.bytes !== media.bytes || object.bytes > STOREFRONT_MEDIA_MAX_BYTES)
        throw new DomainError(
          'UPLOAD_MISMATCH',
          'The branding image upload is missing or has an unexpected size.',
        );
      const body = await storage.get(media.storageKey);
      if (!body || body.length !== media.bytes || sniffImageType(body) !== media.mimeType)
        throw new DomainError('UPLOAD_NOT_IMAGE', 'Upload a valid JPEG, PNG or WebP image.');
      let metadata: Metadata;
      const variants: Record<string, string> = {};
      try {
        metadata = await sharp(body, { limitInputPixels: 16_000_000, animated: false }).metadata();
        if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
          throw new Error('Invalid image dimensions.');
        for (const width of DERIVATIVE_WIDTHS) {
          const key = `storefront/${actor.dealerId}/${mediaId}/${width}.webp`;
          const image = await sharp(body, { limitInputPixels: 16_000_000, animated: false })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          await storage.put(key, image, 'image/webp');
          variants[String(width)] = key;
        }
      } catch (cause) {
        throw new DomainError(
          'BRANDING_PROCESSING_FAILED',
          'The branding image could not be processed. Retry with a smaller image.',
          { cause },
        );
      }
      await storefront.write(actor, async (tx) => {
        await tx.media.updateMany({
          where: { id: mediaId, dealerId: actor.dealerId, status: 'PENDING' },
          data: { status: 'READY', variants, width: metadata.width, height: metadata.height },
        });
      });
      return { mediaId };
    },
  };
}

export type StorefrontMediaService = ReturnType<typeof createStorefrontMedia>;
