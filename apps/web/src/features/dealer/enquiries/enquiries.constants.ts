import type { EnquiryStatus } from '@dealers-drive/contracts';

export const ENQUIRIES_PATH = '/dealer/enquiries';

export const DEFAULT_ENQUIRY_TAB: EnquiryStatus = 'NEW';

export const ENQUIRY_TABS: { value: EnquiryStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'SPAM', label: 'Spam' },
];

export const ENQUIRY_MOVES: Record<EnquiryStatus, { to: EnquiryStatus; label: string }[]> = {
  NEW: [
    { to: 'CONTACTED', label: 'Mark contacted' },
    { to: 'CLOSED', label: 'Close' },
    { to: 'SPAM', label: 'Spam' },
  ],
  CONTACTED: [
    { to: 'CLOSED', label: 'Close' },
    { to: 'SPAM', label: 'Spam' },
  ],
  CLOSED: [{ to: 'NEW', label: 'Reopen' }],
  SPAM: [{ to: 'NEW', label: 'Not spam' }],
};

export const ENQUIRIES_TEXT = {
  title: 'Enquiries',
  count: (n: number) => `${n.toLocaleString('en-IN')} enquir${n === 1 ? 'y' : 'ies'}`,
  tabsLabel: 'Filter by status',
  listLabel: 'Enquiries',
  verified: 'Verified',
  call: (phoneDisplay: string) => `Call ${phoneDisplay}`,
  noNumber: 'Number no longer on file',
  about: 'About',
  noMessage: 'Asked to be contacted.',
  receivedOn: (date: string) => `Received ${date}`,
  actionsLabel: (name: string) => `Actions for ${name}’s enquiry`,
  more: 'Show more',
  emptyTitle: {
    NEW: 'No new enquiries',
    CONTACTED: 'Nobody marked contacted',
    CLOSED: 'No closed enquiries',
    SPAM: 'No spam',
  } satisfies Record<EnquiryStatus, string>,
  emptyMessage: {
    NEW: 'When a customer enquires about one of your cars, they appear here with their verified mobile number.',
    CONTACTED: 'Enquiries you have called back appear here once you mark them contacted.',
    CLOSED: 'Enquiries you have finished with appear here.',
    SPAM: 'Enquiries you mark as spam are kept here, out of the way.',
  } satisfies Record<EnquiryStatus, string>,
} as const;
