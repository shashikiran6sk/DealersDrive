import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES, type PhotoCredit } from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

const photos = (count: number) => `${count} ${count === 1 ? 'photo' : 'photos'}`;

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
    'Upload the processed StudioCar images here — the team’s own shoot, or the dealer’s photographs once they meet the photo standard.',
  closed:
    'Images can only be changed while the listing is in review, waiting for changes, live or reserved.',
  liveCount: (count: number, min: number, max: number) =>
    `${count} uploaded · ${min} minimum · ${max} at most`,
  liveHint: (min: number) =>
    `Changes appear on the live listing. Keep at least ${min} images; use Replace to change a photo without removing it first.`,
  replace: 'Replace',
  replaceLabel: (position: number) => `Replace image ${position + 1}`,
  replaceInputLabel: 'Choose a replacement image',
  removeFailed: 'The image could not be removed. Try again.',
  replaced: 'Image replaced.',
  removed: 'Image removed.',
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
  creditLegend: 'Who took these photographs?',
  creditNeeded: 'Choose who took the photographs before uploading.',
  creditUnknown: 'Photographer not recorded',
  markAll: (count: number) => `Mark all ${photos(count)}:`,
  markAllFailed: 'The photos could not be marked. Try again.',
  markedAll: (count: number, credit: PhotoCredit) =>
    `All ${photos(count)} marked as taken by ${credit === 'DEALER' ? 'the dealer' : 'Dealers-Drive'}.`,
  creditUnknownHint: (count: number) =>
    `${count} ${count === 1 ? 'image does' : 'images do'} not say who took ${count === 1 ? 'it' : 'them'}, so the car’s page credits nobody. Mark them all at once, or each one below.`,
} as const;

export const CREDIT_OPTIONS: readonly {
  value: PhotoCredit;
  label: string;
  description: string;
}[] = [
  {
    value: 'DEALERS_DRIVE',
    label: 'Dealers-Drive team',
    description: 'Taken by our photographer at the dealership.',
  },
  {
    value: 'DEALER',
    label: 'The dealership',
    description: 'Sent by the dealer and checked against the photo standard.',
  },
];

export const CREDIT_TEXT: Record<
  PhotoCredit,
  {
    tile: string;
    markAs: string;
    markAsLabel: (position: number) => string;
    markAll: string;
    markAllLabel: (count: number) => string;
  }
> = {
  DEALERS_DRIVE: {
    tile: 'By Dealers-Drive',
    markAs: 'Dealers-Drive took it',
    markAsLabel: (position) => `Mark image ${position + 1} as taken by Dealers-Drive`,
    markAll: 'Dealers-Drive took them',
    markAllLabel: (count) => `Mark all ${photos(count)} as taken by Dealers-Drive`,
  },
  DEALER: {
    tile: 'By the dealer',
    markAs: 'Dealer took it',
    markAsLabel: (position) => `Mark image ${position + 1} as taken by the dealer`,
    markAll: 'Dealer took them',
    markAllLabel: (count) => `Mark all ${photos(count)} as taken by the dealer`,
  },
};
