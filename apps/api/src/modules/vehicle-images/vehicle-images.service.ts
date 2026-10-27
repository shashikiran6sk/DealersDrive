import { randomUUID } from 'node:crypto';

import {
  VEHICLE_IMAGE_MAX,
  isListingPubliclyVisible,
  type AdminVehicleImages,
  type PresignResponse,
  type ReorderImagesInput,
  type VehicleImagePresignInput,
} from '@dealers-drive/contracts';
import type { Listing, ListingStatus, PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import {
  IMAGE_EXTENSIONS,
  sniffImageType,
  type SniffedImageType,
} from '../../platform/media/sniff.js';
import { UPLOAD_INCOMPLETE, UPLOAD_NOT_FOUND } from '../../platform/messages.js';
import { deleteStorageObjects } from '../../platform/storage/cleanup.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import { LISTING_NOT_FOUND, lockListing } from '../listings/listings.facade.js';
import { toAdminVehicleImage } from './vehicle-images.mapper.js';
import {
  IMAGE_NOT_FOUND,
  IMAGES_CLOSED,
  IMAGES_FULL,
  IMAGES_MINIMUM,
  ORDER_MISMATCH,
  UPLOAD_MISMATCH,
  UPLOAD_NOT_IMAGE,
} from './vehicle-images.messages.js';
import { imageCount, imagesOf, renumber } from './vehicle-images.repository.js';

export interface VehicleImagesDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  audit: AuditService;
  config: PlatformConfigService;
}

export const IMAGE_OPEN_STATUSES: readonly ListingStatus[] = [
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'ACTIVE',
  'RESERVED',
];

export const IMAGE_PREVIEW_TTL_SECONDS = 15 * 60;

const PRESIGN_TTL_SECONDS = 15 * 60;

export function vehicleImageKey(
  vehicleId: string,
  mediaId: string,
  mimeType: SniffedImageType,
): string {
  return `vehicles/${vehicleId}/${mediaId}/original.${IMAGE_EXTENSIONS[mimeType]}`;
}

function isOpen(status: ListingStatus): boolean {
  return IMAGE_OPEN_STATUSES.includes(status);
}

function listingNotFound(): NotFoundError {
  return new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });
}

function uploadNotFound(): NotFoundError {
  return new NotFoundError(UPLOAD_NOT_FOUND, { code: 'UPLOAD_NOT_FOUND' });
}

function assertOpen(listing: Listing): void {
  if (!isOpen(listing.status)) {
    throw new ConflictError('IMAGES_CLOSED', IMAGES_CLOSED, {
      extra: { listingStatus: listing.status },
    });
  }
}

function assertRoom(count: number): void {
  if (count >= VEHICLE_IMAGE_MAX) {
    throw new ConflictError('VEHICLE_IMAGES_FULL', IMAGES_FULL(VEHICLE_IMAGE_MAX), {
      extra: { max: VEHICLE_IMAGE_MAX },
    });
  }
}

function mediaKeys(media: { storageKey: string; variants: unknown }): string[] {
  const variants = media.variants;
  return [
    media.storageKey,
    ...(variants && typeof variants === 'object'
      ? Object.values(variants).filter((key): key is string => typeof key === 'string')
      : []),
  ];
}

export function createVehicleImagesService({ prisma, storage, audit, config }: VehicleImagesDeps) {
  async function queueCleanup(tx: Tx, admin: AdminPrincipal, listing: Listing, keys: string[]) {
    if (keys.length === 0) return;
    await enqueueOutbox(tx, {
      type: 'StorageObjectsDelete',
      aggregateType: 'Vehicle',
      aggregateId: listing.vehicleId,
      dealerId: listing.dealerId,
      actor: { type: 'ADMIN', id: admin.userId },
      traceId: getContext()?.traceId ?? 'vehicle-images',
      payload: { keys },
    });
  }
  async function images(vehicleId: string, status: ListingStatus): Promise<AdminVehicleImages> {
    const [rows, min] = await Promise.all([
      imagesOf(prisma, vehicleId),
      config.number('listing.minPhotos'),
    ]);
    const items = await Promise.all(
      rows.map(async (row) =>
        toAdminVehicleImage(
          row,
          await storage.signedReadUrl(row.media.storageKey, IMAGE_PREVIEW_TTL_SECONDS),
        ),
      ),
    );
    return { items, min, max: VEHICLE_IMAGE_MAX, canEdit: isOpen(status) };
  }

  async function listingOf(listingId: string): Promise<Listing> {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw listingNotFound();
    return listing;
  }

  async function lockedOpen(tx: Tx, listingId: string): Promise<Listing> {
    const listing = await lockListing(tx, listingId);
    if (!listing) throw listingNotFound();
    assertOpen(listing);
    return listing;
  }

  async function fail(mediaId: string, storageKey: string): Promise<void> {
    await prisma.media.update({ where: { id: mediaId }, data: { status: 'FAILED' } });
    await storage.delete(storageKey);
  }

  return {
    images,

    minimum(): Promise<number> {
      return config.number('listing.minPhotos');
    },

    async presign(listingId: string, input: VehicleImagePresignInput): Promise<PresignResponse> {
      const listing = await listingOf(listingId);
      assertOpen(listing);
      if (input.replacesMediaId) {
        const rows = await imagesOf(prisma, listing.vehicleId);
        if (!rows.some((row) => row.mediaId === input.replacesMediaId)) {
          throw new NotFoundError(IMAGE_NOT_FOUND, { code: 'IMAGE_NOT_FOUND' });
        }
      } else {
        assertRoom(await imageCount(prisma, listing.vehicleId));
      }

      const mediaId = randomUUID();
      const key = vehicleImageKey(listing.vehicleId, mediaId, input.mimeType);

      await prisma.media.create({
        data: {
          id: mediaId,
          dealerId: listing.dealerId,
          ownerType: 'VEHICLE',
          storageKey: key,
          mimeType: input.mimeType,
          bytes: input.bytes,
          width: input.width ?? null,
          height: input.height ?? null,
          fileName: input.fileName,
          uploadedByAdmin: true,
          status: 'PENDING',
        },
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
        expiresInSeconds: PRESIGN_TTL_SECONDS,
      });

      return {
        mediaId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
        maxBytes: input.bytes,
      };
    },

    async commit(
      admin: AdminPrincipal,
      listingId: string,
      mediaId: string,
      replacesMediaId?: string,
    ): Promise<AdminVehicleImages> {
      const listing = await listingOf(listingId);
      assertOpen(listing);

      const media = await prisma.media.findUnique({
        where: { id: mediaId },
        include: { attachment: true },
      });
      const prefix = `vehicles/${listing.vehicleId}/${mediaId}/`;
      if (
        !media ||
        media.ownerType !== 'VEHICLE' ||
        !media.uploadedByAdmin ||
        !media.storageKey.startsWith(prefix)
      ) {
        throw uploadNotFound();
      }
      if (media.attachment) return images(listing.vehicleId, listing.status);
      if (media.status !== 'PENDING') throw uploadNotFound();

      const object = await storage.head(media.storageKey);
      if (!object) throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
      if (object.bytes !== media.bytes) {
        await fail(media.id, media.storageKey);
        throw new DomainError('UPLOAD_MISMATCH', UPLOAD_MISMATCH);
      }

      const body = await storage.get(media.storageKey);
      if (!body || sniffImageType(body) !== media.mimeType) {
        await fail(media.id, media.storageKey);
        throw new DomainError('UPLOAD_NOT_IMAGE', UPLOAD_NOT_IMAGE);
      }

      const { status, removedKeys } = await withTransaction(prisma, async (tx) => {
        const locked = await lockedOpen(tx, listingId);
        const current = await tx.media.findUniqueOrThrow({
          where: { id: media.id },
          include: { attachment: true },
        });
        if (current.attachment) return { status: locked.status, removedKeys: [] };
        if (current.status !== 'PENDING') throw uploadNotFound();
        const rows = await imagesOf(tx, locked.vehicleId);
        const target = replacesMediaId
          ? rows.find((row) => row.mediaId === replacesMediaId)
          : undefined;
        if (replacesMediaId && !target) {
          throw new NotFoundError(IMAGE_NOT_FOUND, { code: 'IMAGE_NOT_FOUND' });
        }
        const claimed = await tx.media.updateMany({
          where: { id: media.id, status: 'PENDING' },
          data: { status: 'READY' },
        });
        if (claimed.count === 0) return { status: locked.status, removedKeys: [] };

        const count = rows.length;
        if (target) {
          await tx.vehicleMedia.update({
            where: { id: target.id },
            data: { mediaId: media.id, addedBy: admin.userId, createdAt: new Date() },
          });
          await tx.media.update({ where: { id: target.mediaId }, data: { status: 'ORPHAN' } });
        } else {
          assertRoom(count);
          await tx.vehicleMedia.create({
            data: {
              vehicleId: locked.vehicleId,
              mediaId: media.id,
              position: count,
              isPrimary: count === 0,
              source: 'ADMIN_UPLOAD',
              addedBy: admin.userId,
            },
          });
        }

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: locked.dealerId,
          action: target ? 'vehicle.image_replaced' : 'vehicle.image_added',
          entityType: 'Vehicle',
          entityId: locked.vehicleId,
          before: target
            ? { mediaId: target.mediaId, position: target.position, isPrimary: target.isPrimary }
            : undefined,
          after: {
            listingId,
            mediaId: media.id,
            position: target?.position ?? count,
            isPrimary: target?.isPrimary ?? count === 0,
          },
        });
        const removedKeys = target ? mediaKeys(target.media) : [];
        await queueCleanup(tx, admin, locked, removedKeys);
        return { status: locked.status, removedKeys };
      });

      await deleteStorageObjects(storage, removedKeys);
      return images(listing.vehicleId, status);
    },

    async remove(
      admin: AdminPrincipal,
      listingId: string,
      mediaId: string,
    ): Promise<AdminVehicleImages> {
      const minimum = await config.number('listing.minPhotos');
      const { vehicleId, status, storageKey } = await withTransaction(prisma, async (tx) => {
        const listing = await lockedOpen(tx, listingId);
        const rows = await imagesOf(tx, listing.vehicleId);
        const target = rows.find((row) => row.mediaId === mediaId);
        if (!target) throw new NotFoundError(IMAGE_NOT_FOUND, { code: 'IMAGE_NOT_FOUND' });

        if (isListingPubliclyVisible(listing.status) && rows.length - 1 < minimum) {
          throw new ConflictError('VEHICLE_IMAGES_MINIMUM', IMAGES_MINIMUM(minimum), {
            extra: { min: minimum },
          });
        }

        const remaining = rows.filter((row) => row.id !== target.id);
        await tx.vehicleMedia.delete({ where: { id: target.id } });
        await tx.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
        await renumber(
          tx,
          remaining.map((row) => row.id),
        );

        const promoted = target.isPrimary ? remaining[0] : undefined;
        if (promoted) {
          await tx.vehicleMedia.update({ where: { id: promoted.id }, data: { isPrimary: true } });
        }

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'vehicle.image_removed',
          entityType: 'Vehicle',
          entityId: listing.vehicleId,
          before: { mediaId, position: target.position, isPrimary: target.isPrimary },
          after: { listingId, primaryMediaId: promoted?.mediaId ?? null },
        });
        const keys = mediaKeys(target.media);
        await queueCleanup(tx, admin, listing, keys);
        return {
          vehicleId: listing.vehicleId,
          status: listing.status,
          storageKey: keys,
        };
      });

      await deleteStorageObjects(storage, storageKey);
      return images(vehicleId, status);
    },

    async reorder(
      admin: AdminPrincipal,
      listingId: string,
      input: ReorderImagesInput,
    ): Promise<AdminVehicleImages> {
      const { vehicleId, status } = await withTransaction(prisma, async (tx) => {
        const listing = await lockedOpen(tx, listingId);
        const rows = await imagesOf(tx, listing.vehicleId);
        const byMedia = new Map(rows.map((row) => [row.mediaId, row]));
        const ordered = input.mediaIds.map((mediaId) => byMedia.get(mediaId));
        if (rows.length !== ordered.length || ordered.some((row) => row === undefined)) {
          throw new DomainError('IMAGE_ORDER_MISMATCH', ORDER_MISMATCH);
        }

        await renumber(
          tx,
          ordered.flatMap((row) => (row ? [row.id] : [])),
        );
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'vehicle.images_reordered',
          entityType: 'Vehicle',
          entityId: listing.vehicleId,
          before: { mediaIds: rows.map((row) => row.mediaId) },
          after: { listingId, mediaIds: input.mediaIds },
        });
        return { vehicleId: listing.vehicleId, status: listing.status };
      });
      return images(vehicleId, status);
    },

    async setPrimary(
      admin: AdminPrincipal,
      listingId: string,
      mediaId: string,
    ): Promise<AdminVehicleImages> {
      const { vehicleId, status } = await withTransaction(prisma, async (tx) => {
        const listing = await lockedOpen(tx, listingId);
        const rows = await imagesOf(tx, listing.vehicleId);
        const target = rows.find((row) => row.mediaId === mediaId);
        if (!target) throw new NotFoundError(IMAGE_NOT_FOUND, { code: 'IMAGE_NOT_FOUND' });

        const previous = rows.find((row) => row.isPrimary);
        if (previous?.id !== target.id) {
          await tx.vehicleMedia.updateMany({
            where: { vehicleId: listing.vehicleId, isPrimary: true },
            data: { isPrimary: false },
          });
          await tx.vehicleMedia.update({ where: { id: target.id }, data: { isPrimary: true } });
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: admin.userId,
            dealerId: listing.dealerId,
            action: 'vehicle.image_primary_set',
            entityType: 'Vehicle',
            entityId: listing.vehicleId,
            before: { mediaId: previous?.mediaId ?? null },
            after: { listingId, mediaId },
          });
        }
        return { vehicleId: listing.vehicleId, status: listing.status };
      });
      return images(vehicleId, status);
    },
  };
}

export type VehicleImagesService = ReturnType<typeof createVehicleImagesService>;
