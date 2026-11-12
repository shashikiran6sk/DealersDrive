import { PHOTO_SLOT_LABELS, type VehiclePhotoSlot } from '@dealers-drive/contracts';

export const VEHICLE_NOT_FOUND = 'That vehicle does not exist.';

export const PHOTOS_DISABLED =
  'Uploading your own photographs is not switched on yet. Submit the car and our team will arrange the photographs.';

export const PHOTOS_CLOSED =
  'Photographs can only be changed while the car is a draft or our team has asked for changes.';

export const PLAN_NOT_DEALER = 'Choose “Upload the photos yourself” before uploading photographs.';

export const PHOTOSHOOT_UNAVAILABLE = (district: string | null): string =>
  district
    ? `A Dealers-Drive photoshoot is not available in ${district} yet. Upload the photographs yourself instead.`
    : 'A Dealers-Drive photoshoot is not available for your dealership’s location yet. Upload the photographs yourself instead.';

export const EXTRAS_FULL = (max: number): string =>
  `You can add at most ${String(max)} extra photographs. Remove one first.`;

export const PHOTO_NOT_FOUND = 'That photograph is not on this vehicle.';

export const SLOT_TAKEN = 'Another upload for this shot finished first. Reload the page to see it.';

export const UPLOAD_MISMATCH = 'The uploaded file does not match what was declared.';

export const UPLOAD_NOT_IMAGE =
  'That file is not a JPEG, PNG or WebP image, whatever its name or type says.';

export const PLAN_REQUIRED = 'Choose who will photograph the car before submitting it for review.';

export const PHOTOS_INCOMPLETE = (count: number): string =>
  `${String(count)} of the 10 standard photographs ${count === 1 ? 'is' : 'are'} still missing.`;

export const SLOT_MISSING = (slot: VehiclePhotoSlot): string =>
  `Add the ${PHOTO_SLOT_LABELS[slot].toLowerCase()} photograph.`;
