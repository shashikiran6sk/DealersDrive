import type { StatusTone } from '@dealers-drive/contracts';

import type { AdminDocument } from './document-review.types';

export const DOC_TONE: Record<AdminDocument['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

/** Below this a reason is not a reason, and the dealer has nothing to act on. */
export const MIN_REJECTION_REASON = 6;

export const DOCUMENT_REVIEW_TEXT = {
  nothingUploaded: 'Nothing uploaded yet.',
  view: 'View',
  verify: 'Verify',
  /** "Reject file", not "Reject" — the word alone reads as a verdict on the dealership. */
  rejectFile: 'Reject file',
  askForNewFile: 'Ask for a new file',
  decisionFailed: 'That decision did not go through.',
  reasonPlaceholder: 'Shown to the dealer verbatim — say what to re-upload',
  rejectedPrefix: 'Rejected: ',
  reasonLabel: (label: string) => `Reason for rejecting ${label}`,
  rejectConsequence: (label: string) =>
    `Deletes this file and asks the dealer to upload ${label} again. The other documents and everything else they entered are untouched; their application returns to draft so they can reach the upload box.`,
} as const;
