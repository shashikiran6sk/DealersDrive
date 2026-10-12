import type { AdminDealerDetail, YardVisitDto } from '@dealers-drive/contracts';

import { portfolioPhoto } from './portfolio';

type Document = AdminDealerDetail['documents'][number];

export function adminDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    category: 'BUSINESS_IDENTITY',
    categoryLabel: 'Business Identity Proof',
    type: 'GST_CERTIFICATE',
    label: 'GST Registration Certificate',
    status: 'UPLOADED',
    fileName: 'gst-certificate.pdf',
    mimeType: 'application/pdf',
    description: null,
    bytes: 284_112,
    uploadedAt: '2026-09-01T10:22:00.000Z',
    reviewedAt: null,
    submissionCount: 1,
    viewUrl: 'https://storage.example/signed/gst-certificate.pdf',
    viewUrlExpiresAt: '2026-09-01T10:37:00.000Z',
    rejectionReason: null,
    ...overrides,
  };
}

export const PERSONAL_PAN = adminDocument({
  id: '00000000-0000-4000-8000-000000000011',
  category: 'PERSONAL_IDENTITY',
  categoryLabel: 'Personal Identity Proof',
  type: 'PAN_CARD',
  label: 'PAN Card',
  fileName: 'pan.jpg',
  mimeType: 'image/jpeg',
  bytes: 512_904,
});

export const OTHER_CERTIFICATE = adminDocument({
  id: '00000000-0000-4000-8000-000000000012',
  type: 'OTHER_BUSINESS_CERTIFICATE',
  label: 'Other Government-Issued Business Certificate',
  fileName: 'panchayat-licence.pdf',
  description: 'Trade licence issued by Katpadi panchayat, valid to March 2027',
});

export const DOCUMENT_HISTORY: AdminDealerDetail['documentHistory'] = [
  {
    at: '2026-09-03T09:10:00.000Z',
    action: 'REJECTED',
    category: 'PERSONAL_IDENTITY',
    type: 'PAN_CARD',
    reason: 'The scan is cropped — the date of birth is cut off.',
    actorType: 'ADMIN',
  },
  {
    at: '2026-09-01T10:22:00.000Z',
    action: 'SUBMITTED',
    category: 'BUSINESS_IDENTITY',
    type: 'GST_CERTIFICATE',
    reason: null,
    actorType: 'DEALER',
  },
  {
    at: '2026-09-01T10:18:00.000Z',
    action: 'SUBMITTED',
    category: 'PERSONAL_IDENTITY',
    type: 'PAN_CARD',
    reason: null,
    actorType: 'DEALER',
  },
];

export const STANDARD_ACTIVATION: AdminDealerDetail['activation'] = {
  method: 'STANDARD',
  methodLabel: 'Standard approval',
  overriddenAt: null,
  overriddenBy: null,
  justification: null,
  outstanding: [],
};

export const NOT_ACTIVATED: AdminDealerDetail['activation'] = {
  method: null,
  methodLabel: null,
  overriddenAt: null,
  overriddenBy: null,
  justification: null,
  outstanding: ['PERSONAL_IDENTITY', 'BUSINESS_IDENTITY'],
};

export const MANUAL_ACTIVATION: AdminDealerDetail['activation'] = {
  method: 'MANUAL_OVERRIDE',
  methodLabel: 'Manual activation — documents not verified',
  overriddenAt: '2026-10-10T06:30:00.000Z',
  overriddenBy: 'superadmin@dealersdrive.in',
  justification:
    'Field team met the owner at the yard; policy exception OPS-2026-114 approved by compliance.',
  outstanding: ['BUSINESS_IDENTITY'],
};

export const ADMIN_PORTFOLIO = [
  portfolioPhoto(1, { caption: 'Our yard on Katpadi Road' }),
  portfolioPhoto(2, { status: 'PENDING', caption: 'The signboard at our entrance' }),
  portfolioPhoto(3, { previewUrl: null }),
];

export const ISSUE_299_FIELDS: Pick<
  AdminDealerDetail,
  'activation' | 'documentGaps' | 'documentHistory' | 'portfolio' | 'yardVisitCount'
> = {
  activation: STANDARD_ACTIVATION,
  documentGaps: [],
  documentHistory: [],
  portfolio: [],
  yardVisitCount: 0,
};

export const OVERRIDE_ACTIONS: Pick<
  AdminDealerDetail['actions'],
  'canOverrideActivation' | 'overrideBlockedReason' | 'canRevokeOverride'
> = {
  canOverrideActivation: false,
  overrideBlockedReason: null,
  canRevokeOverride: false,
};

export const YARD_VISITS: YardVisitDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    visitedOn: '2026-10-08',
    outcome: 'YARD_CONFIRMED',
    outcomeLabel: 'Yard seen at the address',
    notes: 'Twelve cars on the forecourt; owner and one salesperson present.',
    recordedBy: 'field@dealersdrive.in',
    recordedAt: '2026-10-08T11:00:00.000Z',
    photos: [
      {
        mediaId: '00000000-0000-4000-8000-000000000301',
        url: '/images/home-hero.webp',
        expiresAt: '2026-10-08T11:15:00.000Z',
      },
      {
        mediaId: '00000000-0000-4000-8000-000000000302',
        url: '/og/dealers-drive.png',
        expiresAt: '2026-10-08T11:15:00.000Z',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    visitedOn: '2026-09-20',
    outcome: 'NO_PHYSICAL_YARD',
    outcomeLabel: 'Trades without a physical yard',
    notes: 'Works from a rented office; cars are shown at the buyer’s address.',
    recordedBy: 'field@dealersdrive.in',
    recordedAt: '2026-09-20T08:40:00.000Z',
    photos: [],
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    visitedOn: '2026-09-02',
    outcome: 'NOT_ACCESSIBLE',
    outcomeLabel: 'Could not be visited',
    notes: 'Gate locked on a weekday afternoon.',
    recordedBy: null,
    recordedAt: '2026-09-02T09:00:00.000Z',
    photos: [],
  },
];
