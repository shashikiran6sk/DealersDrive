import { createHash, randomUUID } from 'node:crypto';

import {
  DEALER_PHOTO_EXTRAS_MAX,
  DEALER_PHOTO_UNSORTED_MAX,
  PHOTO_PLAN_LABELS,
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  VehiclePhotoSlot,
  isListingEditable,
  isStandardPhotoSlot,
  photoShortfall,
  submittedPhotoDownloadName,
  submittedPhotosArchiveName,
  vehicleFileBase,
  type SubmittedPhotosDownload,
  type SubmittedPhotosDownloadInput,
  type VehicleFileParts,
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
import {
  authorizeDealerWrite,
  type AdminPrincipal,
  type DealerWriteActor,
} from '../auth/auth.facade.js';
import { storedZip } from '../../platform/archive/zip.js';
import { LISTING_NOT_FOUND, lockListingForVehicle } from '../listings/listings.facade.js';
import {
  EXTRAS_FULL,
  NO_SUBMITTED_PHOTOS,
  PHOTOSHOOT_UNAVAILABLE,
  PHOTOS_CLOSED,
  PHOTOS_DISABLED,
  PHOTO_NOT_FOUND,
  PLAN_NOT_DEALER,
  SLOT_TAKEN,
  UNSORTED_FULL,
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

export const DOWNLOAD_TTL_SECONDS = 5 * 60;

export const ARCHIVE_PREFIX = 'archives/submitted-photos';

export function submittedPhotosArchiveKey(listingId: string, contents: readonly string[]): string {
  const fingerprint = createHash('sha256').update(contents.join('\n')).digest('hex').slice(0, 24);
  return `${ARCHIVE_PREFIX}/${listingId}/${fingerprint}.zip`;
}

export function inShootingOrder<T extends { slot: VehiclePhotoSlot; createdAt: Date }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      VehiclePhotoSlot.options.indexOf(a.slot) - VehiclePhotoSlot.options.indexOf(b.slot) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

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
  return photoShortfall(rows.map((row) => row.slot)).missing;
}

const SHARED_SLOT_LIMITS: Partial<Record<VehiclePhotoSlot, number>> = {
  EXTRA: DEALER_PHOTO_EXTRAS_MAX,
  UNSORTED: DEALER_PHOTO_UNSORTED_MAX,
};

export function assertRoomFor(slot: VehiclePhotoSlot, alreadyThere: number): void {
  const max = SHARED_SLOT_LIMITS[slot];
  if (max === undefined || alreadyThere < max) return;
  throw slot === 'EXTRA'
    ? new ConflictError('PHOTO_EXTRAS_FULL', EXTRAS_FULL(max))
    : new ConflictError('PHOTO_UNSORTED_FULL', UNSORTED_FULL(max));
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
    const { missing, needed } = photoShortfall(rows.map((row) => row.slot));
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
      unsorted: photos.filter((photo) => photo.slot === 'UNSORTED'),
      unsortedMax: DEALER_PHOTO_UNSORTED_MAX,
      missing,
      needed,
      ready:
        !enabled ||
        (plan === 'DEALER' && needed === 0) ||
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
      if (!isStandardPhotoSlot(input.slot)) {
        const alreadyThere = await prisma.vehicleSubmissionPhoto.count({
          where: { vehicleId, slot: input.slot },
        });
        assertRoomFor(input.slot, alreadyThere);
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
          const replaced = isStandardPhotoSlot(slot)
            ? rows.find((row) => row.slot === slot)
            : undefined;
          if (!isStandardPhotoSlot(slot)) {
            assertRoomFor(slot, rows.filter((row) => row.slot === slot).length);
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
      vehicle: VehicleFileParts;
    }): Promise<AdminSubmittedPhotos> {
      const rows = await submissionPhotosOf(prisma, listing.vehicleId);
      const base = vehicleFileBase(listing.vehicle);
      return {
        plan: listing.photoPlan,
        planLabel: listing.photoPlan ? PHOTO_PLAN_LABELS[listing.photoPlan] : null,
        archiveName: submittedPhotosArchiveName(base),
        items: await Promise.all(
          inShootingOrder(rows).map(async (row, index) => ({
            mediaId: row.mediaId,
            slot: row.slot,
            slotLabel: PHOTO_SLOT_LABELS[row.slot],
            url: await storage.signedReadUrl(row.media.storageKey, PHOTO_URL_TTL_SECONDS),
            downloadName: submittedPhotoDownloadName(base, index, row.slot, row.media.mimeType),
            fileName: row.media.fileName,
            mimeType: row.media.mimeType,
            bytes: row.media.bytes,
            uploadedAt: row.createdAt.toISOString(),
          })),
        ),
        missing: listing.photoPlan === 'DEALER' ? missingSlots(rows) : [],
      };
    },

    async adminDownload(
      admin: AdminPrincipal,
      listingId: string,
      input: SubmittedPhotosDownloadInput,
    ): Promise<SubmittedPhotosDownload> {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { vehicle: true },
      });
      if (!listing) throw new NotFoundError(LISTING_NOT_FOUND, { code: 'LISTING_NOT_FOUND' });
      const rows = inShootingOrder(await submissionPhotosOf(prisma, listing.vehicleId));
      const base = vehicleFileBase(listing.vehicle);
      const named = rows.map((row, index) => ({
        row,
        name: submittedPhotoDownloadName(base, index, row.slot, row.media.mimeType),
      }));

      let key: string;
      let fileName: string;
      if (input.mediaId) {
        const one = named.find((entry) => entry.row.mediaId === input.mediaId);
        if (!one) throw new NotFoundError(PHOTO_NOT_FOUND, { code: 'PHOTO_NOT_FOUND' });
        key = one.row.media.storageKey;
        fileName = one.name;
      } else {
        if (named.length === 0) throw new DomainError('NO_SUBMITTED_PHOTOS', NO_SUBMITTED_PHOTOS);
        fileName = submittedPhotosArchiveName(base);
        key = submittedPhotosArchiveKey(
          listingId,
          named.map((entry) => `${entry.row.mediaId}:${entry.name}`),
        );
        if (!(await storage.head(key))) {
          const entries = [];
          for (const entry of named) {
            const data = await storage.get(entry.row.media.storageKey);
            if (!data) throw new NotFoundError(PHOTO_NOT_FOUND, { code: 'PHOTO_NOT_FOUND' });
            entries.push({ name: entry.name, data, modifiedAt: entry.row.createdAt });
          }
          await storage.put(key, storedZip(entries), 'application/zip');
        }
      }

      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: admin.userId,
        dealerId: listing.dealerId,
        action: 'listing.submitted_photos_downloaded',
        entityType: 'Listing',
        entityId: listingId,
        after: { mediaId: input.mediaId ?? null, count: input.mediaId ? 1 : named.length },
      });
      return {
        url: await storage.signedReadUrl(key, DOWNLOAD_TTL_SECONDS, { downloadName: fileName }),
        fileName,
        expiresInSeconds: DOWNLOAD_TTL_SECONDS,
      };
    },
  };
}

export type DealerPhotosService = ReturnType<typeof createDealerPhotosService>;
