import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type DealerDocumentDto,
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
  REQUIRED: 'Required',
  UPLOADING: 'Uploading',
  UPLOADED: 'In review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const DOCUMENT_PATH = {
  presign: '/api/dealer/documents/presign',
  commit: (type: string) => `/api/dealer/documents/${type}/commit`,
  remove: (type: string) => `/api/dealer/documents/${type}`,
} as const;

export const DOCUMENT_UPLOADER_TEXT = {
  verifiedGlyph: '✓',
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
} as const;
