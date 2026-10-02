import type { SupportTicketCounts } from '@dealers-drive/contracts';
import Link from 'next/link';

import { SUPPORT_QUEUE_TABS, SUPPORT_QUEUE_TEXT } from './support-queue.constants';
import type { SupportQueueFilters } from './support-queue.types';
import { supportQueueHref } from './utils';

export function SupportQueueTabs({
  counts,
  filters,
}: {
  counts: SupportTicketCounts;
  filters: SupportQueueFilters;
}) {
  return (
    <nav aria-label={SUPPORT_QUEUE_TEXT.tabsLabel} className="overflow-x-auto">
      <div className="seg">
        {SUPPORT_QUEUE_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={supportQueueHref({ ...filters, status: tab.value })}
            aria-current={filters.status === tab.value ? 'page' : undefined}
            aria-selected={filters.status === tab.value}
            className="seg-opt whitespace-nowrap no-underline"
          >
            {tab.label}
            <span className="tnum ink-subtle">{counts[tab.value ?? 'ALL']}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
