import type { PortfolioPhotoStatus, StatusTone } from '@dealers-drive/contracts';

export const PORTFOLIO_TONE: Record<PortfolioPhotoStatus, StatusTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
  REMOVED: 'neutral',
};

export const PORTFOLIO_STATUS_ADMIN_LABELS: Record<PortfolioPhotoStatus, string> = {
  PENDING: 'Awaiting review',
  APPROVED: 'Approved — public',
  REJECTED: 'Rejected',
  REMOVED: 'Taken down',
};

export const MIN_TAKE_DOWN_REASON = 6;

export const DEALER_PORTFOLIO_TEXT = {
  heading: 'Portfolio photographs',
  queueLink: 'Open the portfolio queue',
  intro:
    'Photographs the dealership chose for its own public page. Not identity evidence and not required for anything; only approved ones are public.',
  empty: 'No portfolio photographs submitted.',
  summary: (approved: number, pending: number) =>
    `${approved} approved · ${pending} awaiting review`,
  noPreview: 'Preview unavailable',
  photoAlt: (index: number) => `Portfolio photograph ${index + 1}`,
  replacement: 'Replacement for an approved photograph',
  rejectedPrefix: 'Rejected: ',
  takeDown: 'Take down',
  takeDownConfirm: 'Take down photograph',
  cancel: 'Cancel',
  reasonLabel: (index: number) => `Reason for taking down photograph ${index + 1}`,
  reasonPlaceholder: 'Shown to the dealer verbatim',
  takeDownNote:
    'Removes it from the public page at once. The dealer sees the reason and can submit a new photograph for review.',
  takeDownFailed: 'That photograph could not be taken down.',
} as const;
