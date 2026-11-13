import type { Listing } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { DomainError } from '../../platform/errors.js';
import { mediaObjectKeys } from '../../platform/media/keys.js';
import { missingSlots } from './dealer-photos.service.js';
import {
  PHOTOSHOOT_UNAVAILABLE,
  PHOTOS_INCOMPLETE,
  PLAN_REQUIRED,
  SLOT_MISSING,
} from './dealer-photos.messages.js';
import { photoshootCoverage, submissionPhotosOf } from './dealer-photos.repository.js';

export async function dealerPhotosEnabled(config: PlatformConfigService): Promise<boolean> {
  return config.flag('feature.dealerPhotos');
}

export async function assertPhotosReady(tx: Tx, listing: Listing): Promise<void> {
  if (!listing.photoPlan) {
    throw new DomainError('PHOTO_PLAN_REQUIRED', PLAN_REQUIRED, {
      errors: [{ field: 'photoPlan', code: 'REQUIRED', message: PLAN_REQUIRED }],
    });
  }
  if (listing.photoPlan === 'DEALERS_DRIVE') {
    const coverage = await photoshootCoverage(tx, listing.dealerId);
    if (!coverage.available) {
      throw new DomainError('PHOTOSHOOT_UNAVAILABLE', PHOTOSHOOT_UNAVAILABLE(coverage.district));
    }
    return;
  }
  const missing = missingSlots(await submissionPhotosOf(tx, listing.vehicleId));
  if (missing.length > 0) {
    throw new DomainError('PHOTOS_INCOMPLETE', PHOTOS_INCOMPLETE(missing.length), {
      errors: missing.map((slot) => ({
        field: `photos.${slot}`,
        code: 'REQUIRED',
        message: SLOT_MISSING(slot),
      })),
    });
  }
}

export async function releaseSubmissionPhotos(
  tx: Tx,
  vehicle: { id: string; dealerId: string },
  actorId: string,
): Promise<string[]> {
  const rows = await submissionPhotosOf(tx, vehicle.id);
  if (rows.length === 0) return [];
  await tx.media.updateMany({
    where: { id: { in: rows.map((row) => row.mediaId) } },
    data: { status: 'ORPHAN' },
  });
  const keys = rows.flatMap((row) => mediaObjectKeys(row.media));
  await enqueueOutbox(tx, {
    type: 'StorageObjectsDelete',
    aggregateType: 'Vehicle',
    aggregateId: vehicle.id,
    dealerId: vehicle.dealerId,
    actor: { type: 'DEALER', id: actorId },
    traceId: getContext()?.traceId ?? 'dealer-photos',
    payload: { keys },
  });
  return keys;
}
