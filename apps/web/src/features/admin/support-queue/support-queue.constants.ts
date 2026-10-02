import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SupportTicketCategory,
  SupportTicketPriority,
  type SupportTicketStatus,
} from '@dealers-drive/contracts';

export const SUPPORT_QUEUE_PATH = '/admin/support';

export const SUPPORT_QUEUE_TABS: { value: SupportTicketStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING_FOR_CUSTOMER', label: 'Waiting for customer' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export const SUPPORT_CATEGORY_FILTERS = SupportTicketCategory.options.map((value) => ({
  value,
  label: SUPPORT_CATEGORY_LABELS[value],
}));

export const SUPPORT_PRIORITY_FILTERS = SupportTicketPriority.options.map((value) => ({
  value,
  label: SUPPORT_PRIORITY_LABELS[value],
}));

export const SUPPORT_QUEUE_TEXT = {
  title: 'Support Tickets',
  intro:
    'Requests customers raise with Dealers-Drive. Reply, add internal notes, set priority and status, and assign them from each ticket.',
  total: (n: number) => `${n.toLocaleString('en-IN')} ticket${n === 1 ? '' : 's'}`,
  tabsLabel: 'Filter by status',
  filtersLabel: 'Search and filter support tickets',
  searchLabel: 'Search',
  searchPlaceholder: 'DD-1042, customer, mobile, dealer or car',
  categoryLabel: 'Category',
  priorityLabel: 'Priority',
  assigneeLabel: 'Assignee',
  fromLabel: 'Created from',
  toLabel: 'Created to',
  any: 'Any',
  anyone: 'Anyone',
  me: 'Assigned to me',
  unassigned: 'Unassigned',
  apply: 'Apply',
  clear: 'Clear',
  caption: 'Support tickets',
  colTicket: 'Ticket',
  colCustomer: 'Customer',
  colCategory: 'Category',
  colContext: 'About',
  colStatus: 'Status · priority',
  priority: (label: string) => `${label} priority`,
  colAssignee: 'Assignee',
  colUpdated: 'Updated',
  colActions: 'Actions',
  noContext: 'No enquiry linked',
  noNumber: 'No number on file',
  nobody: 'Unassigned',
  view: 'Open',
  viewLabel: (reference: string) => `Open ticket ${reference}`,
  emptyTitle: 'No support tickets found',
  emptyMessage: 'When customers create support requests, they appear here.',
  filteredEmptyTitle: 'No support tickets match these filters',
  filteredEmptyMessage: 'Try a different search, another status or a wider date range.',
  more: 'Show more',
} as const;
