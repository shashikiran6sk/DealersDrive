import type {
  AdminPortfolioPhoto,
  DealerPortfolioPhoto,
  DealerPortfolioResponse,
  PublicPortfolioPhoto,
} from '@dealers-drive/contracts';
import { PORTFOLIO_PHOTO_LIMIT, PORTFOLIO_PHOTO_STATUS_LABELS } from '@dealers-drive/contracts';

const IMAGES = [
  '/images/home-hero.webp',
  '/og/dealers-drive.png',
  '/brand/dealer-directory-cover.svg',
];

function imageFor(n: number): string {
  return IMAGES[n % IMAGES.length] ?? '/images/home-hero.webp';
}

export function portfolioPhoto(
  n: number,
  overrides: Partial<DealerPortfolioPhoto> = {},
): DealerPortfolioPhoto {
  const status = overrides.status ?? 'APPROVED';
  return {
    id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
    status,
    statusLabel: PORTFOLIO_PHOTO_STATUS_LABELS[status],
    previewUrl: imageFor(n),
    caption: null,
    replacesId: null,
    position: n,
    rejectionReason: null,
    submittedAt: '2026-10-08T05:30:00.000Z',
    reviewedAt: status === 'PENDING' ? null : '2026-10-09T06:00:00.000Z',
    ...overrides,
  };
}

export function portfolioResponse(
  data: DealerPortfolioPhoto[],
  overrides: Partial<DealerPortfolioResponse> = {},
): DealerPortfolioResponse {
  const active = data.filter(
    (photo) =>
      (photo.status === 'APPROVED' || photo.status === 'PENDING') && photo.replacesId === null,
  ).length;
  return {
    data,
    limit: PORTFOLIO_PHOTO_LIMIT,
    canAdd: active < PORTFOLIO_PHOTO_LIMIT,
    ...overrides,
  };
}

const APPROVED_FRONT = portfolioPhoto(1, { caption: 'Our yard on Katpadi Road' });

export const PORTFOLIO_EMPTY = portfolioResponse([]);

export const PORTFOLIO_PENDING = portfolioResponse([
  portfolioPhoto(1, { status: 'PENDING', caption: 'The signboard at our entrance' }),
]);

export const PORTFOLIO_APPROVED = portfolioResponse([
  APPROVED_FRONT,
  portfolioPhoto(2, { caption: 'The showroom floor' }),
]);

export const PORTFOLIO_REJECTED = portfolioResponse([
  APPROVED_FRONT,
  portfolioPhoto(2, {
    status: 'REJECTED',
    rejectionReason: 'This is a photo of one car, not the dealership. Upload a photo of the yard.',
  }),
]);

export const PORTFOLIO_REPLACEMENT_PENDING = portfolioResponse([
  APPROVED_FRONT,
  portfolioPhoto(2, {
    status: 'PENDING',
    replacesId: APPROVED_FRONT.id,
    caption: 'Our yard on Katpadi Road, after the repaint',
  }),
]);

export const PORTFOLIO_FULL = portfolioResponse(
  Array.from({ length: PORTFOLIO_PHOTO_LIMIT }, (_, index) =>
    portfolioPhoto(index + 1, { status: index < 6 ? 'APPROVED' : 'PENDING' }),
  ),
);

export const PORTFOLIO_MIXED = portfolioResponse([
  APPROVED_FRONT,
  portfolioPhoto(2, { caption: 'The showroom floor' }),
  portfolioPhoto(3, { status: 'PENDING', replacesId: APPROVED_FRONT.id }),
  portfolioPhoto(4, { status: 'PENDING', caption: 'Our service bay' }),
  portfolioPhoto(5, { status: 'REJECTED', rejectionReason: 'The photo is too dark to make out.' }),
]);

export function adminPortfolioPhoto(
  n: number,
  overrides: Partial<AdminPortfolioPhoto> = {},
): AdminPortfolioPhoto {
  return {
    ...portfolioPhoto(n, { status: 'PENDING', caption: 'The yard from the road' }),
    dealerId: '3c8f2b10-2222-4000-8000-000000000002',
    dealerName: 'Sri Lakshmi Motors',
    dealerSlug: 'sri-lakshmi-motors',
    replacesPreviewUrl: null,
    ...overrides,
  };
}

export const ADMIN_PORTFOLIO_NEW = adminPortfolioPhoto(1);

export const ADMIN_PORTFOLIO_REPLACEMENT = adminPortfolioPhoto(2, {
  replacesId: '00000000-0000-4000-8000-000000000099',
  replacesPreviewUrl: imageFor(0),
  caption: 'Our yard after the repaint',
  dealerName: 'Vellore Car Bazaar',
  dealerSlug: 'vellore-car-bazaar',
});

export const ADMIN_PORTFOLIO_REJECTED = adminPortfolioPhoto(3, {
  status: 'REJECTED',
  statusLabel: PORTFOLIO_PHOTO_STATUS_LABELS.REJECTED,
  rejectionReason: 'A photo of one car, not the dealership.',
  reviewedAt: '2026-10-09T06:00:00.000Z',
});

export const PUBLIC_PORTFOLIO: PublicPortfolioPhoto[] = [
  { url: imageFor(0), caption: 'Our yard on Katpadi Road' },
  { url: imageFor(1), caption: 'The showroom floor' },
  { url: imageFor(2), caption: null },
];
