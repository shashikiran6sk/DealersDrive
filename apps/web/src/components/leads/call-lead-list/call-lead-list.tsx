import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';

import { CallLeadCard } from './call-lead-card';
import { CALL_LEAD_TEXT } from './call-lead-list.constants';
import type { CallLeadListProps } from './call-lead-list.types';

export function CallLeadList({ leads, audience, nextHref }: CallLeadListProps) {
  if (leads.length === 0) {
    return (
      <EmptyState
        title={CALL_LEAD_TEXT.emptyTitle}
        message={
          audience === 'admin'
            ? CALL_LEAD_TEXT.adminEmptyMessage
            : CALL_LEAD_TEXT.dealerEmptyMessage
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <ul
        aria-label={CALL_LEAD_TEXT.listLabel}
        className="m-0 flex list-none flex-col gap-[10px] p-0"
      >
        {leads.map((lead) => (
          <CallLeadCard key={lead.id} lead={lead} />
        ))}
      </ul>
      {nextHref ? (
        <Link href={nextHref} className="relative btn btn-secondary self-center">
          <LinkPendingLabel>{CALL_LEAD_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
