import type { ListingStatus, ReactivationRequestStatus } from '@dealers-drive/contracts';

import { countLabel } from '@/lib/plural';

export const MODERATION_PATH = '/admin/listings';

export const REACTIVATION_VIEW = 'reactivation';

export const MODERATION_TABS: { value: ListingStatus; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'DRAFT', label: 'Draft' },
];

export const REACTIVATION_TABS: { value: ReactivationRequestStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Declined' },
  { value: 'CANCELLED', label: 'Closed' },
];

export const MODERATION_TEXT = {
  title: 'Listings',
  waiting: (n: number) => `${n.toLocaleString('en-IN')} awaiting review`,
  tabsLabel: 'Filter by status',
  searchLabel: 'Search listings',
  searchPlaceholder: 'Plate, make, model or dealer',
  search: 'Search',
  clear: 'Clear',
  caption: 'Listings in this status',
  resubmitted: 'Resubmitted',
  images: (count: number) => countLabel(count, 'image'),
  review: 'Review',
  noPrice: 'No price',
  queueClearTitle: 'Queue clear',
  queueClearMessage: 'Nothing is waiting for review.',
  emptyTitle: 'Nothing here',
  emptyMessage: 'No listing matches this filter.',
  more: 'Show more',
  reactivationTab: 'Reactivation requests',
} as const;

export const REACTIVATION_TEXT = {
  title: 'Reactivation requests',
  intro:
    'A dealer cannot put a reserved or withdrawn car back on sale directly. Approving moves the listing to Active; declining leaves it where it is.',
  waiting: (n: number) => `${n.toLocaleString('en-IN')} awaiting a decision`,
  tabsLabel: 'Filter reactivation requests',
  caption: 'Reactivation requests in this status',
  transition: (from: string, to: string) => `${from} → ${to}`,
  noReason: 'No note from the dealer',
  outdated: 'Listing has moved since',
  view: 'Open listing',
  approve: 'Approve',
  approveTitle: 'Put this car back on sale?',
  approveBody:
    'The listing goes back to Active and appears on the marketplace again, with its photographs and details unchanged.',
  approveConfirm: 'Approve and reactivate',
  reject: 'Decline',
  rejectTitle: 'Decline this request?',
  rejectBody: 'The listing stays as it is. The dealer sees your note and can ask again later.',
  rejectConfirm: 'Decline request',
  noteLabel: 'Note to the dealer',
  noteHint: 'Optional — shown to the dealer verbatim',
  adminNote: 'Note:',
  clearTitle: 'Nothing waiting',
  clearMessage: 'No dealer is waiting to put a car back on sale.',
  emptyTitle: 'Nothing here',
  emptyMessage: 'No reactivation request in this status.',
  more: 'Show more',
} as const;
