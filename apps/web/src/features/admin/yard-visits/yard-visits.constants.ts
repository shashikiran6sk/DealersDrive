import {
  YARD_VISIT_PHOTO_MAX_BYTES,
  YARD_VISIT_PHOTO_MIME_TYPES,
  type StatusTone,
  type YardVisitOutcome,
} from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

export const OUTCOME_TONE: Record<YardVisitOutcome, StatusTone> = {
  YARD_CONFIRMED: 'ok',
  NO_PHYSICAL_YARD: 'neutral',
  NOT_ACCESSIBLE: 'warn',
};

export const YARD_VISIT_PHOTO_RULE: FileRule = {
  maxBytes: YARD_VISIT_PHOTO_MAX_BYTES,
  mimeTypes: YARD_VISIT_PHOTO_MIME_TYPES,
  tooLarge: 'That image is larger than 10 MB.',
  wrongType: 'Upload a JPEG, PNG or WebP.',
};

export const MAX_VISIT_NOTES = 2000;

export function yardVisitPhotoPaths(dealerId: string, visitId: string) {
  const base = `/api/admin/dealers/${encodeURIComponent(dealerId)}/yard-visits/${encodeURIComponent(visitId)}/photos`;
  return { presign: `${base}/presign`, commit: `${base}/commit` };
}

export const YARD_VISITS_TEXT = {
  heading: 'Internal yard visits',
  privacy:
    'Private staff evidence. Never shown to buyers or to the dealer, never required for activation, and not a route to Dealer Verified.',
  noYardIsFine:
    'Trading without a physical yard is legitimate — record it as found. It is not a penalty and changes nothing about the dealership’s standing.',
  noYardRowNote: 'Recorded as found — not a penalty.',
  empty: 'No visits recorded.',
  recordHeading: 'Record a visit',
  dateLabel: 'Visited on',
  outcomeLabel: 'What was found',
  notesLabel: 'Notes',
  notesPlaceholder: 'Internal — what the visit showed, who was met, anything to follow up',
  record: 'Record visit',
  recorded: 'Visit recorded.',
  recordFailed: 'We could not record that visit.',
  recordedBy: (who: string, when: string) => `Recorded by ${who} · ${when}`,
  recordedAt: (when: string) => `Recorded ${when}`,
  photoAlt: (index: number, date: string) => `Yard visit photograph ${index + 1}, ${date}`,
  addPhoto: 'Add photograph',
  uploading: 'Uploading…',
  photoInputLabel: (date: string) => `Add a photograph to the visit on ${date}`,
  photoLimit: (limit: number) => `This visit holds the most photographs it can (${limit}).`,
  missingId: 'The upload was signed without a media id.',
  commitFailed: 'We could not attach that photograph.',
  uploadFailed: 'That upload failed.',
} as const;
