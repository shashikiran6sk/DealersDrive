import Link from 'next/link';

import { Avatar, StatusTag } from '@/components/ui/primitives';

import { CALL_LEAD_TEXT } from './call-lead-list.constants';
import type { CallLeadCardProps } from './call-lead-list.types';

export function CallLeadCard({ lead }: CallLeadCardProps) {
  const { customer, vehicle } = lead;

  return (
    <li className="card flex flex-col gap-[12px] bg-white p-[18px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <Avatar initials={customer.initials} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-extrabold">{customer.name}</div>
          {customer.phoneDisplay ? (
            <span className="font-mono text-[13px] whitespace-nowrap tnum">
              {customer.phoneDisplay}
            </span>
          ) : (
            <div className="text-[12px] ink-subtle">{CALL_LEAD_TEXT.noNumber}</div>
          )}
        </div>
        {lead.dealer ? <StatusTag tone="neutral">{lead.dealer.name}</StatusTag> : null}
        <time dateTime={lead.lastRevealedAt} className="text-[11px] whitespace-nowrap ink-faint">
          {lead.lastRevealedAgoLabel}
        </time>
      </div>

      <p className="m-0 text-[13px] ink-muted">
        {CALL_LEAD_TEXT.about}{' '}
        {vehicle.href ? (
          <Link href={vehicle.href} className="font-semibold text-(--color-ink)">
            {vehicle.title}
          </Link>
        ) : (
          <strong className="text-(--color-ink)">{vehicle.title}</strong>
        )}{' '}
        <span className="font-mono text-[11px] ink-subtle">{vehicle.registrationDisplay}</span>
      </p>
      <p className="m-0 text-[12px] ink-subtle">
        {lead.revealCount > 1
          ? CALL_LEAD_TEXT.viewedTimes(lead.revealCount, lead.firstRevealedLabel)
          : CALL_LEAD_TEXT.firstViewed(lead.firstRevealedLabel)}
      </p>

      {customer.callHref && customer.phoneDisplay ? (
        <div className="border-t border-(--color-divider) pt-[10px]">
          <a
            href={customer.callHref}
            className="btn btn-primary min-h-[44px] max-sm:w-full sm:min-h-[36px]"
          >
            {CALL_LEAD_TEXT.call(customer.phoneDisplay)}
          </a>
        </div>
      ) : null}
    </li>
  );
}
