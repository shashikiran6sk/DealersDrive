import type { DealerEnquiryCounts } from '@dealers-drive/contracts';
import Link from 'next/link';

import { ENQUIRY_OVERSIGHT_TABS, ENQUIRY_OVERSIGHT_TEXT } from './enquiry-oversight.constants';
import type { EnquiryOversightFilters } from './enquiry-oversight.types';
import { oversightHref } from './utils';

export function EnquiryOversightTabs({
  counts,
  filters,
}: {
  counts: DealerEnquiryCounts;
  filters: EnquiryOversightFilters;
}) {
  return (
    <nav aria-label={ENQUIRY_OVERSIGHT_TEXT.tabsLabel} className="overflow-x-auto">
      <div className="seg">
        {ENQUIRY_OVERSIGHT_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={oversightHref({ ...filters, status: tab.value })}
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
