import type { NotificationStatus } from '@dealers-drive/contracts';

export const NOTIFICATION_LOG_TEXT = {
  title: 'Message deliveries',
  intro:
    'Every email and SMS the platform has tried to send. Retrying ones are attempted again with backoff; failed ones will not be — a permanent refusal, or the last of six attempts.',
  total: (count: number) => `${count.toLocaleString('en-IN')} in all`,
  caption: 'Message deliveries, newest first',
  colWhen: 'When',
  colTo: 'To',
  colEmail: 'Message',
  colDealer: 'Dealership',
  colStatus: 'Status',
  attempts: (count: number) => `${count} attempt${count === 1 ? '' : 's'}`,
  searchLabel: 'Search recipient, template or subject',
  searchPlaceholder: 'name@example.com',
  search: 'Search',
  clear: 'Clear',
  older: 'Older deliveries →',
  emptyTitle: 'No deliveries',
  emptyMessage: 'Nothing has been sent that matches this view.',
  tabAll: 'All',
} as const;

export const NOTIFICATION_TABS: readonly (NotificationStatus | 'ALL')[] = [
  'ALL',
  'FAILED',
  'PENDING',
  'SENT',
];

export const LOG_PATH = '/admin/notifications';
