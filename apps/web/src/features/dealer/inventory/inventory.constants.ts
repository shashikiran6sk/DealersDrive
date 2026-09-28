import type { ListingStatus } from '@dealers-drive/contracts';

export const INVENTORY_PATH = '/dealer/inventory';

export const INVENTORY_TABS: { value: ListingStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export const INVENTORY_TEXT = {
  title: 'Inventory',
  count: (n: number) => `${n.toLocaleString('en-IN')} vehicle${n === 1 ? '' : 's'}`,
  tabsLabel: 'Filter by status',
  searchLabel: 'Search your inventory',
  searchPlaceholder: 'Registration, make or model',
  search: 'Search',
  clear: 'Clear',
  caption: 'Your vehicles',
  open: 'Open',
  edit: 'Edit',
  noPrice: 'No price yet',
  incomplete: 'Details missing',
  emptyTitle: 'No vehicles yet',
  emptyMessage: 'Add your first vehicle. We photograph it once you submit it for review.',
  emptyFilteredTitle: 'Nothing here',
  emptyFilteredMessage: 'No vehicle matches this filter.',
  addVehicle: 'Add vehicle',
  more: 'Show more',
  changesRequested: 'Changes requested:',
} as const;
