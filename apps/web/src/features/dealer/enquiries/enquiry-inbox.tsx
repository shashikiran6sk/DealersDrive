import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';

import { ENQUIRIES_TEXT, ENQUIRY_TABS } from './enquiries.constants';
import type { EnquiryInboxProps } from './enquiries.types';
import { EnquiryCard } from './enquiry-card';
import { enquiriesHref } from './utils';

export function EnquiryInbox({ inbox, status, permissions }: EnquiryInboxProps) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{ENQUIRIES_TEXT.title}</h1>
        <p className="text-[13px] ink-muted tnum">{ENQUIRIES_TEXT.count(inbox.counts.ALL)}</p>
      </div>

      <nav aria-label={ENQUIRIES_TEXT.tabsLabel} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-[8px]">
          {ENQUIRY_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={enquiriesHref({ status: tab.value })}
              aria-current={status === tab.value ? 'page' : undefined}
              aria-selected={status === tab.value}
              className="relative dd-chip no-underline"
            >
              <LinkPendingLabel>
                {tab.label}
                <span className="tnum opacity-70">{inbox.counts[tab.value]}</span>
              </LinkPendingLabel>
            </Link>
          ))}
        </div>
      </nav>

      {inbox.data.length === 0 ? (
        <EmptyState
          title={ENQUIRIES_TEXT.emptyTitle[status]}
          message={ENQUIRIES_TEXT.emptyMessage[status]}
        />
      ) : (
        <ul
          aria-label={ENQUIRIES_TEXT.listLabel}
          className="m-0 flex list-none flex-col gap-[10px] p-0"
        >
          {inbox.data.map((enquiry) => (
            <EnquiryCard key={enquiry.id} enquiry={enquiry} permissions={permissions} />
          ))}
        </ul>
      )}

      {inbox.page.nextCursor ? (
        <Link
          href={enquiriesHref({ status, cursor: inbox.page.nextCursor })}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{ENQUIRIES_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
