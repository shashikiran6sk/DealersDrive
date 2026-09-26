import type { ListingStatus } from '@dealers-drive/contracts';

export const MODERATION_PATH = '/admin/listings';

export const MODERATION_TABS: { value: ListingStatus; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'REMOVED', label: 'Removed' },
  { value: 'DRAFT', label: 'Draft' },
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
  noPrice: 'No price',
  queueClearTitle: 'Queue clear',
  queueClearMessage: 'Nothing is waiting for review.',
  emptyTitle: 'Nothing here',
  emptyMessage: 'No listing matches this filter.',
  more: 'Show more',
} as const;
