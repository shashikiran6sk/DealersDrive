import { z } from 'zod';

import { Uuid } from './common.js';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from './dealer.js';

/**
 * Dealer photographs (partially revises **R45**).
 *
 * R45 made Dealers-Drive the only photographer. A dealer may now photograph
 * the car themselves — but a dealer's photograph is never published as it
 * is. It is raw material: the review team downloads it, checks it against
 * the Dealers-Drive photo standard, processes it in StudioCar and uploads the
 * finished file through the existing admin image routes with credit `DEALER`.
 * Only that finished file can ever reach a buyer.
 */

/** Who photographs the car. Mirrors the Prisma enum `PhotoPlan`. */
export const PhotoPlan = z.enum(['DEALER', 'DEALERS_DRIVE']);
export type PhotoPlan = z.infer<typeof PhotoPlan>;

export const PHOTO_PLAN_LABELS: Record<PhotoPlan, string> = {
  DEALER: 'Dealer uploads the photographs',
  DEALERS_DRIVE: 'Dealers-Drive photoshoot',
};

/**
 * The ten shots of the Dealers-Drive photo standard, in the order a
 * photographer walks round the car, then `EXTRA` for anything else worth
 * showing (engine bay, boot, a scratch the buyer should know about).
 */
export const VehiclePhotoSlot = z.enum([
  'FRONT_THREE_QUARTER',
  'FRONT',
  'LEFT_SIDE',
  'REAR_THREE_QUARTER',
  'REAR',
  'RIGHT_SIDE',
  'DASHBOARD',
  'FRONT_SEATS',
  'REAR_SEATS',
  'ODOMETER',
  'EXTRA',
]);
export type VehiclePhotoSlot = z.infer<typeof VehiclePhotoSlot>;

export type StandardPhotoSlot = Exclude<VehiclePhotoSlot, 'EXTRA'>;

export function isStandardPhotoSlot(slot: VehiclePhotoSlot): slot is StandardPhotoSlot {
  return slot !== 'EXTRA';
}

/** The ten required shots, in walk-round order. */
export const STANDARD_PHOTO_SLOTS: readonly StandardPhotoSlot[] =
  VehiclePhotoSlot.options.filter(isStandardPhotoSlot);

export const PHOTO_SLOT_LABELS: Record<VehiclePhotoSlot, string> = {
  FRONT_THREE_QUARTER: 'Front three-quarter',
  FRONT: 'Front',
  LEFT_SIDE: 'Left side',
  REAR_THREE_QUARTER: 'Rear three-quarter',
  REAR: 'Rear',
  RIGHT_SIDE: 'Right side',
  DASHBOARD: 'Dashboard and steering',
  FRONT_SEATS: 'Front seats',
  REAR_SEATS: 'Rear seats',
  ODOMETER: 'Odometer reading',
  EXTRA: 'Extra photograph',
};

/** The most extra photographs a dealer may add beyond the ten. */
export const DEALER_PHOTO_EXTRAS_MAX = 6;

/** Choosing who photographs the car. Only while the listing is editable. */
export const SetPhotoPlanInput = z.object({ plan: PhotoPlan }).strict();
export type SetPhotoPlanInput = z.infer<typeof SetPhotoPlanInput>;

/**
 * Starting one upload. The client names the slot and the file, never a path:
 * the storage key is the server's, `vehicles/{vehicleId}/submitted/{mediaId}/…`.
 */
export const DealerPhotoPresignInput = z
  .object({
    slot: VehiclePhotoSlot,
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    bytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
  })
  .strict();
export type DealerPhotoPresignInput = z.infer<typeof DealerPhotoPresignInput>;

export const VehiclePhotoParam = z.object({ id: Uuid, mediaId: Uuid }).strict();
export type VehiclePhotoParam = z.infer<typeof VehiclePhotoParam>;

/** One of the dealer's own photographs. `url` is a short-lived signed URL. */
export const DealerSubmissionPhoto = z.object({
  mediaId: Uuid,
  slot: VehiclePhotoSlot,
  slotLabel: z.string(),
  url: z.string(),
  fileName: z.string().nullable(),
  bytes: z.number().int(),
  uploadedAt: z.string(),
});
export type DealerSubmissionPhoto = z.infer<typeof DealerSubmissionPhoto>;

/**
 * Everything the wizard's Photos step needs, in one read.
 *
 * `enabled` is the `feature.dealerPhotos` flag: while it is off the step is
 * not shown and submission does not ask for a plan. `photoshoot.available`
 * is the dealership's district's `photographyAvailable` — the admin's
 * service-locations switch, today on for Vellore. `ready` is the server's
 * answer to "may this car be submitted, as far as photographs go".
 */
export const DealerVehiclePhotos = z.object({
  enabled: z.boolean(),
  plan: PhotoPlan.nullable(),
  canEdit: z.boolean(),
  photoshoot: z.object({ available: z.boolean(), district: z.string().nullable() }),
  slots: z.array(
    z.object({
      slot: VehiclePhotoSlot,
      label: z.string(),
      photo: DealerSubmissionPhoto.nullable(),
    }),
  ),
  extras: z.array(DealerSubmissionPhoto),
  extrasMax: z.number().int(),
  missing: z.array(VehiclePhotoSlot),
  ready: z.boolean(),
});
export type DealerVehiclePhotos = z.infer<typeof DealerVehiclePhotos>;

/**
 * The dealer's photographs as the review team sees them, for download and
 * processing. `downloadName` is ordered and named for StudioCar —
 * `TN23AB1234-01-front-three-quarter.jpg` — so a folder of downloads is
 * already a batch.
 */
export const AdminSubmittedPhoto = z.object({
  mediaId: Uuid,
  slot: VehiclePhotoSlot,
  slotLabel: z.string(),
  url: z.string(),
  downloadName: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string(),
  bytes: z.number().int(),
  uploadedAt: z.string(),
});
export type AdminSubmittedPhoto = z.infer<typeof AdminSubmittedPhoto>;

export const AdminSubmittedPhotos = z.object({
  plan: PhotoPlan.nullable(),
  planLabel: z.string().nullable(),
  items: z.array(AdminSubmittedPhoto),
  missing: z.array(VehiclePhotoSlot),
});
export type AdminSubmittedPhotos = z.infer<typeof AdminSubmittedPhotos>;

/** `TN23AB1234-01-front-three-quarter.jpg` — the StudioCar batch name. */
export function submittedPhotoDownloadName(
  registrationNumber: string,
  index: number,
  slot: VehiclePhotoSlot,
  mimeType: string,
): string {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const name = PHOTO_SLOT_LABELS[slot].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${registrationNumber}-${String(index + 1).padStart(2, '0')}-${name}.${extension}`;
}
