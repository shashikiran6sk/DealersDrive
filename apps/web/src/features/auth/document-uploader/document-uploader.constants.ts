import {
  DOCUMENT_DESCRIPTION_MAX,
  DOCUMENT_DESCRIPTION_MIN,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type DealerDocumentDto,
  type SelectableDocCategory,
  type StatusTone,
} from '@dealers-drive/contracts';

import type { FileRule } from '@/lib/upload';

export const DOCUMENT_RULE: FileRule = {
  maxBytes: DOCUMENT_MAX_BYTES,
  mimeTypes: DOCUMENT_MIME_TYPES,
  tooLarge: 'That file is larger than 5MB.',
  wrongType: 'Upload a PDF, JPEG or PNG.',
};

export const TONE: Record<DealerDocumentDto['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

export const TAG: Record<DealerDocumentDto['status'], string> = {
  REQUIRED: 'Needed to submit',
  UPLOADING: 'Unfinished',
  UPLOADED: 'In review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const DEALER_DOCUMENT_BASE = '/api/dealer/documents';

export function documentPaths(base: string) {
  return {
    presign: `${base}/presign`,
    commit: (category: SelectableDocCategory) => `${base}/${category}/commit`,
    remove: (category: SelectableDocCategory) => `${base}/${category}`,
  };
}

export const CATEGORY_NOTES: Record<SelectableDocCategory, string> = {
  PERSONAL_IDENTITY:
    'One document that identifies the person who manages the dealership. Aadhaar is voluntary — any listed proof works instead.',
  BUSINESS_IDENTITY: 'One government-issued document that identifies the dealership itself.',
};

export const CATEGORY_GLYPHS: Record<SelectableDocCategory, string> = {
  PERSONAL_IDENTITY: 'ID',
  BUSINESS_IDENTITY: 'BIZ',
};

export const GSTIN_LENGTH = 15;

export const GSTIN_FIELD = 'body.gstin';

export const DESCRIPTION_LIMITS = {
  min: DOCUMENT_DESCRIPTION_MIN,
  max: DOCUMENT_DESCRIPTION_MAX,
} as const;

export const DOCUMENT_UPLOADER_TEXT = {
  verifiedGlyph: '✓',
  typeLabel: 'Document type',
  typePlaceholder: 'Choose a document',
  descriptionLabel: 'Describe the certificate',
  descriptionPlaceholder: 'Name of the certificate and the authority that issued it',
  noFile: 'No file yet — PDF, JPEG or PNG, up to 5 MB',
  gstinCleared:
    'Your GSTIN is on file with your GST Registration Certificate. Choosing a different business proof removes the GSTIN.',
  gstinLabel: 'GSTIN',
  gstinHint: 'optional — as printed on the certificate',
  gstinPlaceholder: '33ABCDE1234F1Z5',
  gstinInvalid: 'Enter a valid 15-character GSTIN, or leave it blank.',
  chooseType: 'Choose which document you are uploading first.',
  describeFirst: `Describe the certificate and who issued it, in ${String(DOCUMENT_DESCRIPTION_MIN)}–${String(DOCUMENT_DESCRIPTION_MAX)} characters, first.`,
  fileMeta: (label: string, status: string) => `${label} · ${status}`,
  rejected: (reason: string) => `Rejected: ${reason}`,
  uploading: 'Uploading…',
  upload: 'Upload',
  replace: 'Replace',
  removing: 'Removing…',
  remove: 'Delete',
  missingId: 'The upload was signed without a document id.',
  commitFailed: 'We could not record that document.',
  removeFailed: 'We could not remove that document.',
  uploadFailed: 'That upload failed.',
  removeUnknown: 'That could not be removed.',
  inputLabel: (label: string) => `Upload ${label}`,
  locked:
    'This document is with our team and can no longer be changed here. Contact support if it needs correcting.',
} as const;
