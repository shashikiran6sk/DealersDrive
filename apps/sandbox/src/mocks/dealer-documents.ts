import type { DealerDocumentDto } from '@dealers-drive/contracts';

export function dealerDocument(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    category: 'PERSONAL_IDENTITY',
    categoryLabel: 'Personal Identity Proof',
    type: 'PAN_CARD',
    label: 'PAN Card',
    status: 'VERIFIED',
    statusLabel: 'Verified',
    fileName: 'pan.pdf',
    mimeType: 'application/pdf',
    bytes: 182_400,
    description: null,
    uploadedAt: '2026-10-08T09:00:00.000Z',
    reviewedAt: '2026-10-09T11:00:00.000Z',
    rejectionReason: null,
    submissionCount: 1,
    action: 'Replace',
    ...overrides,
  };
}

export const PERSONAL_VERIFIED = dealerDocument();

export const BUSINESS_VERIFIED = dealerDocument({
  id: '00000000-0000-4000-8000-0000000000e2',
  category: 'BUSINESS_IDENTITY',
  categoryLabel: 'Business Identity Proof',
  type: 'GST_CERTIFICATE',
  label: 'GST Registration Certificate',
  fileName: 'gst-certificate.pdf',
});

export const BUSINESS_REJECTED = dealerDocument({
  ...BUSINESS_VERIFIED,
  type: 'UDYAM',
  label: 'Udyam Registration Certificate',
  fileName: 'udyam.jpg',
  mimeType: 'image/jpeg',
  status: 'REJECTED',
  statusLabel: 'Rejected — upload a replacement',
  rejectionReason: 'The scan is too blurry to read. Send a clearer copy.',
  action: 'Resubmit',
});

export const BUSINESS_IN_REVIEW = dealerDocument({
  ...BUSINESS_VERIFIED,
  status: 'UPLOADED',
  statusLabel: 'Submitted · awaiting review',
  reviewedAt: null,
});

export const DOCUMENTS_GSTIN = '33AABCS1429B1ZX';
