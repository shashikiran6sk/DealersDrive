import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

export const IMAGE_RULE: FileRule = {
  maxBytes: IMAGE_MAX_BYTES,
  mimeTypes: IMAGE_MIME_TYPES,
  tooLarge: 'is over 10 MB',
  wrongType: 'is not a JPEG, PNG or WebP image',
};

export const LISTING_IMAGES_TEXT = {
  heading: 'Images',
  count: (count: number, min: number, max: number) =>
    `${count} uploaded · ${min} needed to approve · ${max} at most`,
  belowMinimum: (missing: number) =>
    `${missing} more ${missing === 1 ? 'image is' : 'images are'} needed before this listing can be approved.`,
  empty:
    'Dealers-Drive photographs the car after submission; upload the processed StudioCar images here.',
  closed: 'Images can only be changed while the listing is in review.',
  upload: 'Upload images',
  uploading: (done: number, total: number) => `Uploading ${done + 1} of ${total}…`,
  inputLabel: 'Choose processed images to upload',
  full: (max: number) => `This vehicle already has ${max} images, the most it can carry.`,
  tooMany: (room: number) =>
    `Only ${room} more ${room === 1 ? 'image fits' : 'images fit'}; the rest were not uploaded.`,
  fileRefused: (name: string, why: string) => `${name} ${why}.`,
  fileFailed: (name: string, why: string) => `${name}: ${why}`,
  storageRefused: 'storage refused the upload',
  primary: 'Primary',
  position: (position: number) => `Image ${position + 1}`,
  alt: (position: number, primary: boolean) =>
    primary ? `Image ${position + 1}, the primary image` : `Image ${position + 1}`,
  remove: 'Remove',
  makePrimary: 'Make primary',
  makePrimaryLabel: (position: number) => `Make image ${position + 1} the primary image`,
  moveEarlier: '←',
  moveEarlierLabel: (position: number) => `Move image ${position + 1} earlier`,
  moveLater: '→',
  moveLaterLabel: (position: number) => `Move image ${position + 1} later`,
  removeLabel: (position: number) => `Remove image ${position + 1}`,
} as const;
