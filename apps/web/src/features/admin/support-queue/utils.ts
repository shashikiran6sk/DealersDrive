import { qs } from '@/lib/api';

import { SUPPORT_QUEUE_PATH } from './support-queue.constants';
import type { SupportQueueFilters } from './support-queue.types';

export function supportQueueHref(filters: SupportQueueFilters & { cursor?: string }): string {
  return `${SUPPORT_QUEUE_PATH}${qs({
    status: filters.status,
    category: filters.category,
    priority: filters.priority,
    assignee: filters.assignee,
    q: filters.q,
    from: filters.from,
    to: filters.to,
    cursor: filters.cursor,
  })}`;
}

export function isQueueFiltered(filters: SupportQueueFilters): boolean {
  return Boolean(
    filters.category ||
    filters.priority ||
    filters.assignee ||
    filters.q ||
    filters.from ||
    filters.to,
  );
}
