import type { NotificationStatus } from '@dealers-drive/contracts';

import { LOG_PATH } from './notification-log.constants';

export interface NotificationLogFilters {
  status?: NotificationStatus | undefined;
  q?: string | undefined;
}

export function logHref(filters: NotificationLogFilters, cursor?: string): string {
  const search = new URLSearchParams();
  if (filters.status) search.set('status', filters.status);
  if (filters.q) search.set('q', filters.q);
  if (cursor) search.set('cursor', cursor);
  const query = search.toString();
  return query ? `${LOG_PATH}?${query}` : LOG_PATH;
}
