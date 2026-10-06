import type { EnquiryStatus } from '@dealers-drive/contracts';

export const ENQUIRY_OVERSIGHT_PATH = '/admin/enquiries';

export const ENQUIRY_OVERSIGHT_TABS: { value: EnquiryStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'SPAM', label: 'Spam' },
];

export const ENQUIRY_OVERSIGHT_TEXT = {
  title: 'Enquiries',
  intro:
    'Every customer enquiry across every dealership, as the dealership received it. Read-only — the dealership moves an enquiry between its tabs.',
  total: (n: number) => `${n.toLocaleString('en-IN')} enquir${n === 1 ? 'y' : 'ies'}`,
  tabsLabel: 'Filter by status',
  filtersLabel: 'Search and filter enquiries',
  searchLabel: 'Search',
  searchPlaceholder: 'Customer, mobile, dealer, car or plate',
  fromLabel: 'Sent from',
  toLabel: 'Sent to',
  apply: 'Apply',
  clear: 'Clear',
  dealerFilter: 'Dealer',
  unknownDealer: (slug: string) => `No dealership “${slug}”`,
  removeDealer: (name: string) => `Remove the ${name} filter`,
  caption: 'Customer enquiries',
  colCustomer: 'Customer',
  colVehicle: 'Vehicle',
  colDealer: 'Dealer',
  colMessage: 'Message',
  colStatus: 'Status',
  colReceived: 'Received',
  colActions: 'Actions',
  noNumber: 'No number on file',
  noMessage: 'Asked to be contacted',
  listing: (label: string) => `Listing ${label.toLowerCase()}`,
  filterByDealer: (name: string) => `Show only enquiries to ${name}`,
  view: 'View',
  viewLabel: (name: string) => `View ${name}’s enquiry`,
  emptyTitle: 'No enquiries found',
  emptyMessage: 'When customers enquire about cars on Dealers-Drive, every enquiry appears here.',
  filteredEmptyTitle: 'No enquiries match these filters',
  filteredEmptyMessage: 'Try a different search, another status or a wider date range.',
  more: 'Show more',
} as const;
