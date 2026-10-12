import type { StatusTone } from '@dealers-drive/contracts';

import { countLabel } from '@/lib/plural';

import type {
  PortfolioModerationStatus,
  PortfolioModerationTab,
} from './portfolio-moderation.types';

export const MIN_PORTFOLIO_REASON = 6;

export const PORTFOLIO_MODERATION_TABS: readonly PortfolioModerationTab[] = [
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const PORTFOLIO_MODERATION_TONE: Record<PortfolioModerationStatus, StatusTone> = {
  PENDING: 'warn',
  REJECTED: 'err',
};

export const PORTFOLIO_MODERATION_TEXT = {
  title: 'Dealer photos',
  intro:
    'Photographs dealers want on their own public page. Nothing here is public until it is approved, and a replacement leaves the current photo up until it is. Photos are presentation only: they are not identity evidence and do not affect Dealer Verified.',
  tabsLabel: 'Photo review status',
  listLabel: 'Photos to review',
  count: (count: number) => countLabel(count, 'photo'),
  emptyPendingTitle: 'Nothing waiting',
  emptyPendingMessage: 'Every dealer photo has been reviewed.',
  emptyRejectedTitle: 'No rejected photos',
  emptyRejectedMessage: 'Photos you reject appear here with the reason the dealer was given.',
  forbiddenTitle: 'You do not have access to photo review',
  forbiddenMessage:
    'Dealer photos are reviewed by moderators. Ask a Super admin if you need this queue.',
  statusLabel: { PENDING: 'Awaiting review', REJECTED: 'Rejected' },
  replacement: 'Replacement',
  submitted: (when: string) => `Submitted ${when}`,
  reviewed: (when: string) => `Reviewed ${when}`,
  liveNow: 'Live now',
  proposed: 'Proposed replacement',
  submittedPhoto: 'Submitted photo',
  liveAlt: (dealerName: string) => `${dealerName} — the approved photo on their page now`,
  proposedAlt: (dealerName: string) => `${dealerName} — the photo submitted for review`,
  liveGone: 'The photo it replaces is no longer on the page',
  noPreview: 'Preview unavailable',
  captionLabel: 'Caption',
  noCaption: 'No caption',
  reasonGiven: (reason: string) => `Reason given: ${reason}`,
  approve: 'Approve',
  rejectOpen: 'Reject…',
  reject: 'Reject photo',
  cancel: 'Cancel',
  reasonLabel: 'Why is it rejected?',
  reasonHint: 'the dealer reads this word for word',
  reasonPlaceholder:
    'The photo shows a single car, not the dealership. Upload a photo of the yard.',
  decisionFailed: 'That decision did not go through.',
} as const;
