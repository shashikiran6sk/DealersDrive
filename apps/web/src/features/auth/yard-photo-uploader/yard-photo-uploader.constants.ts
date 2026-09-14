import { YARD_PHOTO_MAX_BYTES, YARD_PHOTO_MIME_TYPES } from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

export const YARD_PHOTO_RULE: FileRule = {
  maxBytes: YARD_PHOTO_MAX_BYTES,
  mimeTypes: YARD_PHOTO_MIME_TYPES,
  tooLarge: 'That image is larger than 10MB.',
  wrongType: 'Upload a JPEG, PNG or WebP.',
};

export const YARD_PHOTO_PATH = {
  presign: '/api/dealer/yard-photo/presign',
  commit: '/api/dealer/yard-photo/commit',
  remove: '/api/dealer/yard-photo',
} as const;

export const YARD_PHOTO_TEXT = {
  heading: 'Photo of your yard',
  emptySlot: 'No photo yet — JPEG, PNG or WebP, up to 10 MB',
  inputLabel: 'Upload a photo of your yard',
  imageAlt: 'The dealership yard, as buyers will see it',
  uploaded: 'Uploaded',
  uploading: 'Uploading…',
  upload: 'Upload photo',
  replace: 'Replace photo',
  removing: 'Removing…',
  remove: 'Delete',
  missingId: 'The upload was signed without a media id.',
  commitFailed: 'We could not record that photo.',
  removeFailed: 'We could not remove that photo.',
  uploadFailed: 'That upload failed.',
  removeUnknown: 'That could not be removed.',
} as const;
