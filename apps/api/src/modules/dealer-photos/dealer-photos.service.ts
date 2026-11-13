import { randomUUID } from 'node:crypto';

import {
  DEALER_PHOTO_EXTRAS_MAX,
  PHOTO_PLAN_LABELS,
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  VehiclePhotoSlot,
  isListingEditable,
  submittedPhotoDownloadName,
  type AdminSubmittedPhotos,
  type DealerPhotoPresignInput,
  type DealerSubmissionPhoto,
  type DealerVehiclePhotos,
  type PhotoPlan,
  type PresignResponse,
  type StandardPhotoSlot,
} from '@dealers-drive/contracts';
import type { Listing, PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError, errorCode } from '../../platform/errors.js';
import { mediaObjectKeys } from '../../platform/media/keys.js';
import { IMAGE_EXTENSIONS, sniffImageType } from '../../platform/media/sniff.js';
import { UPLOAD_INCOMPLETE, UPLOAD_NOT_FOUND } from '../../platform/messages.js';
import { deleteStorageObjects } from '../../platform/storage/cleanup.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { authorizeDealerWrite, type DealerWriteActor } from '../auth/auth.facade.js';
import { lockListingForVehicle } from '../listings/listings.facade.js';
import {
  EXTRAS_FULL,
  PHOTOSHOOT_UNAVAILABLE,
  PHOTOS_CLOSED,
  PHOTOS_DISABLED,
  PHOTO_NOT_FOUND,
  PLAN_NOT_DEALER,
  SLOT_TAKEN,
  UPLOAD_MISMATCH,
  UPLOAD_NOT_IMAGE,
  VEHICLE_NOT_FOUND,
} from './dealer-photos.messages.js';
import {
  photoshootCoverage,
  submissionPhotosOf,
  type SubmissionPhotoRow,
} from './dealer-photos.repository.js';

export const PHOTO_URL_TTL_SECONDS = 15 * 60;

const PRESIGN_TTL_SECONDS = 15 * 60;

export interface DealerPhotosDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  audit: AuditService;
  config: PlatformConfigService;
}

export type DealerPhotoActor = DealerWriteActor;

const SLOT_SEGMENT = /\/submitted\/[0-9a-f-]{36}\/([a-z_]+)\.(jpg|png|webp)$/;

export function submissionPhotoKey(
  vehicleId: string,
  mediaId: string,
  slot: VehiclePhotoSlot,
  mimeType: keyof typeof IMAGE_EXTENSIONS,
): string {
  return `vehicles/${vehicleId}/submitted/${mediaId}/${slot.toLowerCase()}.${IMAGE_EXTENSIONS[mimeType]}`;
}

export function slotOfKey(key: string): VehiclePhotoSlot | null {
  const parsed = VehiclePhotoSlot.safeParse(SLOT_SEGMENT.exec(key)?.[1]?.toUpperCase());
  return parsed.success ? parsed.data : null;
}

export function missingSlots(rows: readonly { slot: VehiclePhotoSlot }[]): StandardPhotoSlot[] {
  const present = new Set(rows.map((row) => row.slot));
  return STANDARD_PHOTO_SLOTS.filter((slot) => !present.has(slot));
}

function vehicleNotFound(): NotFoundError {
  return new NotFoundError(VEHICLE_NOT_FOUND, { code: 'VEHICLE_NOT_FOUND' });
}

function uploadNotFound(): NotFoundError {
  return new NotFoundError(UPLOAD_NOT_FOUND, { code: 'UPLOAD_NOT_FOUND' });
}

function assertEditable(listing: Listing): void {
  if (!isListingEditable(listing.status)) {
    throw new ConflictError('PHOTOS_CLOSED', PHOTOS_CLOSED, {
      extra: { listingStatus: listing.status },
    });
  }
}

export function createDealerPhotosService({ prisma, storage, audit, config }: DealerPhotosDeps) {
  async function signed(row: SubmissionPhotoRow): Promise<DealerSubmissionPhoto> {
    return {
      mediaId: row.mediaId,
      slot: row.slot,
      slotLabel: PHOTO_SLOT_LABELS[row.slot],
      url: await storage.signedReadUrl(row.media.storageKey, PHOTO_URL_TTL_SECONDS),
      fileName: row.media.fileName,
      bytes: row.media.bytes,
      uploadedAt: row.createdAt.toISOString(),
    };
  }

  async function ownedListing(dealerId: string, vehicleId: string): Promise<Listing> {
    const listing = await prisma.listing.findUnique({ where: { vehicleId } });
    if (!listing || listing.dealerId !== dealerId) throw vehicleNotFound();
    return listing;
  }

  async function assertEnabled(): Promise<void> {
    if (!(await config.flag('feature.dealerPhotos'))) {
      throw new ConflictError('DEALER_PHOTOS_DISABLED', PHOTOS_DISABLED);
    }
  }

  async function lockedForWrite(tx: Tx, actor: DealerPhotoActor, vehicleId: string) {
    const listing = await lockListingForVehicle(tx, vehicleId);
    if (!listing || listing.dealerId !== actor.dealerId) throw vehicleNotFound();
    await authorizeDealerWrite(tx, actor, 'vehicle:write');
    assertEditable(listing);
    return listing;
  }

  async function queueCleanup(tx: Tx, actor: DealerPhotoActor, vehicleId: string, keys: string[]) {
    if (keys.length === 0) return;
    await enqueueOutbox(tx, {
      type: 'StorageObjectsDelete',
      aggregateType: 'Vehicle',
      aggregateId: vehicleId,
      dealerId: actor.dealerId,
      actor: { type: 'DEALER', id: actor.userId },
      traceId: getContext()?.traceId ?? 'dealer-photos',
      payload: { keys },
    });
  }

  async function view(dealerId: string, vehicleId: string): Promise<DealerVehiclePhotos> {
    const listing = await ownedListing(dealerId, vehicleId);
    const [enabled, rows, photoshoot] = await Promise.all([
      config.flag('feature.dealerPhotos'),
      submissionPhotosOf(prisma, vehicleId),
      photoshootCoverage(prisma, dealerId),
    ]);
    const photos = await Promise.all(rows.map(signed));
    const missing = missingSlots(rows);
    const plan = listing.photoPlan;
    return {
      enabled,
      plan,
      canEdit: enabled && isListingEditable(listing.status),
      photoshoot,
      slots: STANDARD_PHOTO_SLOTS.map((slot) => ({
        slot,
        label: PHOTO_SLOT_LABELS[slot],
        photo: photos.find((photo) => photo.slot === slot) ?? null,
      })),
      extras: photos.filter((photo) => photo.slot === 'EXTRA'),
      extrasMax: DEALER_PHOTO_EXTRAS_MAX,
      missing,
      ready:
        !enabled ||
        (plan === 'DEALER' && missing.length === 0) ||
        (plan === 'DEALERS_DRIVE' && photoshoot.available),
    };
  }

  return {
    view,

    async setPlan(actor: DealerPhotoActor, vehicleId: string, plan: PhotoPlan) {
      await assertEnabled();
      await withTransaction(prisma, async (tx) => {
        const listing = await lockedForWrite(tx, actor, vehicleId);
        if (plan === 'DEALERS_DRIVE') {
          const coverage = await photoshootCoverage(tx, actor.dealerId);
          if (!coverage.available) {
            throw new DomainError(
              'PHOTOSHOOT_UNAVAILABLE',
              PHOTOSHOOT_UNAVAILABLE(coverage.district),
            );
          }
        }
        if (listing.photoPlan === plan) return;
        await tx.listing.update({ where: { id: listing.id }, data: { photoPlan: plan } });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'listing.photo_plan_set',
          entityType: 'Listing',
          entityId: listing.id,
          before: { photoPlan: listing.photoPlan },
          after: { photoPlan: plan, vehicleId },
        });
      });
      return view(actor.dealerId, vehicleId);
    },

    async presign(
      actor: DealerPhotoActor,
      vehicleId: string,
      input: DealerPhotoPresignInput,
    ): Promise<PresignResponse> {
      await assertEnabled();
      const listing = await ownedListing(actor.dealerId, vehicleId);
      assertEditable(listing);
      if (listing.photoPlan !== 'DEALER')
        throw new ConflictError('PHOTO_PLAN_NOT_DEALER', PLAN_NOT_DEALER);
      if (input.slot === 'EXTRA') {
        const extras = await prisma.vehicleSubmissionPhoto.count({
          where: { vehicleId, slot: 'EXTRA' },
        });
        if (extras >= DEALER_PHOTO_EXTRAS_MAX) {
          throw new ConflictError('PHOTO_EXTRAS_FULL', EXTRAS_FULL(DEALER_PHOTO_EXTRAS_MAX));
        }
      }

      const mediaId = randomUUID();
      const key = submissionPhotoKey(vehicleId, mediaId, input.slot, input.mimeType);
      await prisma.media.create({
        data: {
          id: mediaId,
          dealerId: actor.dealerId,
          ownerType: 'VEHICLE_SUBMISSION',
          storageKey: key,
          mimeType: input.mimeType,
          bytes: input.bytes,
          fileName: input.fileName,
          uploadedByAdmin: false,
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

    async commit(actor: DealerPhotoActor, vehicleId: string, mediaId: string) {
      await assertEnabled();
      await ownedListing(actor.dealerId, vehicleId);
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
        include: { submission: true },
      });
      const slot = media ? slotOfKey(media.storageKey) : null;
      if (
        !media ||
        !slot ||
        media.ownerType !== 'VEHICLE_SUBMISSION' ||
        media.dealerId !== actor.dealerId ||
        !media.storageKey.startsWith(`vehicles/${vehicleId}/submitted/${mediaId}/`)
      ) {
        throw uploadNotFound();
      }
      if (media.submission) return view(actor.dealerId, vehicleId);
      if (media.status !== 'PENDING') throw uploadNotFound();

      const object = await storage.head(media.storageKey);
      if (!object) throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
      const body = object.bytes === media.bytes ? await storage.get(media.storageKey) : null;
      if (!body || sniffImageType(body) !== media.mimeType) {
        await prisma.media.update({ where: { id: media.id }, data: { status: 'FAILED' } });
        await storage.delete(media.storageKey);
        throw object.bytes === media.bytes
          ? new DomainError('UPLOAD_NOT_IMAGE', UPLOAD_NOT_IMAGE)
          : new DomainError('UPLOAD_MISMATCH', UPLOAD_MISMATCH);
      }

      let removedKeys: string[];
      try {
        removedKeys = await withTransaction(prisma, async (tx) => {
          const listing = await lockedForWrite(tx, actor, vehicleId);
          const claimed = await tx.media.updateMany({
            where: { id: media.id, status: 'PENDING' },
            data: { status: 'READY' },
          });
          if (claimed.count === 0) return [];

          const rows = await submissionPhotosOf(tx, vehicleId);
          const replaced = slot === 'EXTRA' ? undefined : rows.find((row) => row.slot === slot);
          if (
            slot === 'EXTRA' &&
            rows.filter((row) => row.slot === 'EXTRA').length >= DEALER_PHOTO_EXTRAS_MAX
          ) {
            throw new ConflictError('PHOTO_EXTRAS_FULL', EXTRAS_FULL(DEALER_PHOTO_EXTRAS_MAX));
          }
          if (replaced) {
            await tx.vehicleSubmissionPhoto.delete({ where: { id: replaced.id } });
            await tx.media.update({ where: { id: replaced.mediaId }, data: { status: 'ORPHAN' } });
          }
          await tx.vehicleSubmissionPhoto.create({
            data: {
              vehicleId,
              dealerId: actor.dealerId,
              mediaId: media.id,
              slot,
              uploadedBy: actor.userId,
            },
          });
          await audit.record(tx, {
            actorType: 'DEALER',
            actorId: actor.userId,
            dealerId: actor.dealerId,
            action: replaced ? 'vehicle.dealer_photo_replaced' : 'vehicle.dealer_photo_added',
            entityType: 'Vehicle',
            entityId: vehicleId,
            after: {
              listingId: listing.id,
              mediaId: media.id,
              slot,
              replacedMediaId: replaced?.mediaId ?? null,
            },
          });
          const keys = replaced ? mediaObjectKeys(replaced.media) : [];
          await queueCleanup(tx, actor, vehicleId, keys);
          return keys;
        });
      } catch (error) {
        if (errorCode(error) === 'P2002') throw new ConflictError('PHOTO_SLOT_TAKEN', SLOT_TAKEN);
        throw error;
      }
      await deleteStorageObjects(storage, removedKeys);
      return view(actor.dealerId, vehicleId);
    },

    async remove(actor: DealerPhotoActor, vehicleId: string, mediaId: string) {
      await assertEnabled();
      await ownedListing(actor.dealerId, vehicleId);
      const keys = await withTransaction(prisma, async (tx) => {
        const listing = await lockedForWrite(tx, actor, vehicleId);
        const row = await tx.vehicleSubmissionPhoto.findFirst({
          where: { vehicleId, mediaId },
          include: { media: true },
        });
        if (!row) throw new NotFoundError(PHOTO_NOT_FOUND, { code: 'PHOTO_NOT_FOUND' });
        await tx.vehicleSubmissionPhoto.delete({ where: { id: row.id } });
        await tx.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actor.userId,
          dealerId: actor.dealerId,
          action: 'vehicle.dealer_photo_removed',
          entityType: 'Vehicle',
          entityId: vehicleId,
          before: { mediaId, slot: row.slot },
          after: { listingId: listing.id },
        });
        const removed = mediaObjectKeys(row.media);
        await queueCleanup(tx, actor, vehicleId, removed);
        return removed;
      });
      await deleteStorageObjects(storage, keys);
      return view(actor.dealerId, vehicleId);
    },

    async adminSubmitted(listing: {
      vehicleId: string;
      photoPlan: PhotoPlan | null;
      registrationNumber: string;
    }): Promise<AdminSubmittedPhotos> {
      const rows = await submissionPhotosOf(prisma, listing.vehicleId);
      const ordered = [...rows].sort(
        (a, b) =>
          VehiclePhotoSlot.options.indexOf(a.slot) - VehiclePhotoSlot.options.indexOf(b.slot),
      );
      return {
        plan: listing.photoPlan,
        planLabel: listing.photoPlan ? PHOTO_PLAN_LABELS[listing.photoPlan] : null,
        items: await Promise.all(
          ordered.map(async (row, index) => ({
            mediaId: row.mediaId,
            slot: row.slot,
            slotLabel: PHOTO_SLOT_LABELS[row.slot],
            url: await storage.signedReadUrl(row.media.storageKey, PHOTO_URL_TTL_SECONDS),
            downloadName: submittedPhotoDownloadName(
              listing.registrationNumber,
              index,
              row.slot,
              row.media.mimeType,
            ),
            fileName: row.media.fileName,
            mimeType: row.media.mimeType,
            bytes: row.media.bytes,
            uploadedAt: row.createdAt.toISOString(),
          })),
        ),
        missing: listing.photoPlan === 'DEALER' ? missingSlots(rows) : [],
      };
    },
  };
}

export type DealerPhotosService = ReturnType<typeof createDealerPhotosService>;
