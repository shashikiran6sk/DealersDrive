import {
  PORTFOLIO_PHOTO_MAX_BYTES,
  PORTFOLIO_PHOTO_MIME_TYPES,
  type PortfolioPhotoStatus,
  type StatusTone,
} from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

import type { PortfolioPaths } from './portfolio-manager.types';

export const PORTFOLIO_CAPTION_MAX = 120;

export const PORTFOLIO_PHOTO_RULE: FileRule = {
  maxBytes: PORTFOLIO_PHOTO_MAX_BYTES,
  mimeTypes: PORTFOLIO_PHOTO_MIME_TYPES,
  tooLarge: 'That photograph is larger than 10 MB.',
  wrongType: 'Choose a JPEG, PNG or WebP photograph.',
};

export const PORTFOLIO_PATHS: PortfolioPaths = {
  presign: '/api/dealer/portfolio/presign',
  commit: '/api/dealer/portfolio/commit',
  remove: '/api/dealer/portfolio',
};

export const PORTFOLIO_STATUS_TONE: Record<PortfolioPhotoStatus, StatusTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
  REMOVED: 'neutral',
};

export const PORTFOLIO_TEXT = {
  title: 'Dealership photos',
  intro:
    'Optional photographs of your yard, showroom or signboard, shown on your dealership’s own page. Directory listings keep the standard image.',
  moderation:
    'Photos appear on your public page after our team approves them. Your current photo stays up until its replacement is approved.',
  formats: 'JPEG, PNG or WebP, up to 10 MB each.',
  count: (used: number, limit: number) => `${used} of ${limit} photos`,
  full: (limit: number) =>
    `You have ${limit} photos. Remove one to add another, or replace an approved photo.`,
  listLabel: 'Your dealership photos',
  emptyTitle: 'No photos yet',
  emptyMessage:
    'Add a clear, well-lit photograph of your yard or the signboard at your entrance. Buyers see it on your dealership page once it is approved.',
  add: 'Add photo',
  replace: 'Replace',
  remove: 'Remove',
  replaceLabel: (position: number) => `Replace photo ${position}`,
  removeLabel: (position: number) => `Remove photo ${position}`,
  cancel: 'Cancel',
  photoLabel: (position: number) => `Photo ${position}`,
  previewAlt: (position: number, caption: string | null) =>
    caption ? caption : `Dealership photo ${position}`,
  noPreview: 'Preview unavailable',
  noCaption: 'No caption',
  replaces: (position: number | null) =>
    position === null
      ? 'Replacement — your current photo stays up until this is approved.'
      : `Replacement for photo ${position} — that photo stays up until this is approved.`,
  replacementWaiting: 'A replacement is awaiting review.',
  rejectedBecause: (reason: string) => `Not approved: ${reason}`,
  rejectedNoReason: 'Not approved.',
  addTitle: 'Add a photo',
  addDescription:
    'It is checked by our team before it appears on your page. Until then only you can see it.',
  replaceTitle: (position: number) => `Replace photo ${position}`,
  replaceDescription:
    'Your current photo stays on your page until our team approves this one, then it takes its place.',
  fileLabel: 'Photograph',
  fileHint: 'JPEG, PNG or WebP, up to 10 MB',
  captionLabel: 'Caption',
  captionHint: (max: number) => `optional, up to ${max} characters`,
  captionPlaceholder: 'Our yard on Katpadi Road',
  submit: 'Submit for review',
  submitted: 'Photo submitted. It appears on your page once our team approves it.',
  replacementSubmitted:
    'Replacement submitted. Your current photo stays up until our team approves it.',
  removed: 'Photo removed.',
  removeTitle: (position: number) => `Remove photo ${position}?`,
  removeApproved: 'It comes off your public page straight away. This cannot be undone.',
  removeApprovedWithReplacement:
    'It comes off your public page straight away. Its replacement stays in review as a new photo.',
  removePending: 'It is withdrawn from review and deleted.',
  removeRejected: 'It is deleted.',
  removeConfirm: 'Remove photo',
  missingId: 'The upload was signed without a media id.',
  startFailed: 'We could not start that upload.',
  commitFailed: 'We could not submit that photo for review.',
  uploadFailed: 'That upload failed.',
  removeFailed: 'We could not remove that photo.',
} as const;
