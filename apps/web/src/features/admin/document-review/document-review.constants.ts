import type { DealerDocCategory, StatusTone } from '@dealers-drive/contracts';

import type { AdminDocument, DocumentHistoryEntry } from './document-review.types';

export const DOC_TONE: Record<AdminDocument['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

export const MIN_REJECTION_REASON = 6;

export const CATEGORY_ORDER: readonly DealerDocCategory[] = [
  'PERSONAL_IDENTITY',
  'BUSINESS_IDENTITY',
  'SUPPORTING',
];

export const HISTORY_ACTION_LABELS: Record<DocumentHistoryEntry['action'], string> = {
  SUBMITTED: 'Submitted',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const HISTORY_TONE: Record<DocumentHistoryEntry['action'], StatusTone> = {
  SUBMITTED: 'neutral',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

export const DOCUMENT_REVIEW_TEXT = {
  nothingUploaded: 'Nothing uploaded yet.',
  nothingInCategory: 'Nothing submitted in this category yet.',
  view: 'View',
  verify: 'Verify',
  rejectFile: 'Reject file',
  revokeVerification: 'Revoke verification',
  askForNewFile: 'Ask for a new file',
  confirmRevoke: 'Revoke and ask for a new file',
  cancel: 'Cancel',
  decisionFailed: 'That decision did not go through.',
  reasonPlaceholder: 'Shown to the dealer verbatim — say what to re-upload',
  revokePlaceholder: 'Shown to the dealer verbatim — say why it no longer stands',
  rejectedPrefix: 'Rejected: ',
  descriptionPrefix: 'Described as: ',
  reasonLabel: (label: string) => `Reason for rejecting ${label}`,
  revokeLabel: (label: string) => `Reason for revoking the verification of ${label}`,
  rejectConsequence: (label: string) =>
    `Deletes this file and asks the dealer to upload ${label} again. The other documents and everything else they entered are untouched; their application returns to draft so they can reach the upload box.`,
  revokeConsequence: (label: string) =>
    `Withdraws a verification already given. The ${label} file is deleted, any Dealer Verified badge is withdrawn until a new review, and the dealer is asked to submit this category again with your reason shown to them. An active dealership stays active; an application awaiting approval returns to draft so the dealer can resubmit.`,
  submissions: (count: number) => (count === 1 ? '1 submission' : `${count} submissions`),
  uploadedOn: (date: string) => `uploaded ${date}`,
  reviewedOn: (date: string) => `reviewed ${date}`,
  gapsHeading: 'Still outstanding for standard approval',
  gapsNone: 'Both document categories are met.',
  historyHeading: (count: number) => `Review history (${count})`,
  historyEmpty: 'No submissions or decisions recorded yet.',
  historyBy: (actorType: string) => `by ${actorType.toLowerCase()}`,
  unknownDocument: 'A document',
} as const;

export const BYTE_UNITS = ['B', 'KB', 'MB'] as const;
