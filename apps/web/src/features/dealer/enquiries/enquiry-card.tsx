import Link from 'next/link';

import { Avatar, StatusTag } from '@/components/ui/primitives';

import { ENQUIRIES_TEXT } from './enquiries.constants';
import type { EnquiryCardProps } from './enquiries.types';
import { EnquiryStatusActions } from './enquiry-status-actions';

export function EnquiryCard({ enquiry }: EnquiryCardProps) {
  const { customer, vehicle } = enquiry;

  return (
    <li className="card flex flex-col gap-[10px] bg-white p-[14px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <Avatar initials={customer.initials} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{customer.name}</div>
          {customer.phoneDisplay ? (
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="font-mono text-[13px] whitespace-nowrap tnum">
                {customer.phoneDisplay}
              </span>
              <StatusTag tone="ok">{ENQUIRIES_TEXT.verified}</StatusTag>
            </div>
          ) : (
            <div className="text-[12px] ink-subtle">{ENQUIRIES_TEXT.noNumber}</div>
          )}
        </div>
        <StatusTag tone={enquiry.statusTone}>{enquiry.statusLabel}</StatusTag>
        <time
          dateTime={enquiry.createdAt}
          title={ENQUIRIES_TEXT.receivedOn(enquiry.createdLabel)}
          className="text-[11px] whitespace-nowrap ink-faint"
        >
          {enquiry.timeAgoLabel}
        </time>
      </div>

      <p className="m-0 text-[13px] ink-muted">
        {ENQUIRIES_TEXT.about}{' '}
        {vehicle.href ? (
          <Link href={vehicle.href} className="font-semibold text-(--color-ink)">
            {vehicle.title}
          </Link>
        ) : (
          <strong className="text-(--color-ink)">{vehicle.title}</strong>
        )}{' '}
        <span className="font-mono text-[11px] ink-subtle">{vehicle.registrationDisplay}</span>
      </p>
      <p className="m-0 text-[13px] whitespace-pre-line">
        {enquiry.message ?? <span className="ink-subtle">{ENQUIRIES_TEXT.noMessage}</span>}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-[8px] border-t border-(--color-divider) pt-[10px]">
        {customer.callHref && customer.phoneDisplay ? (
          <a
            href={customer.callHref}
            className="btn btn-primary min-h-[44px] max-sm:w-full sm:min-h-[36px]"
          >
            {ENQUIRIES_TEXT.call(customer.phoneDisplay)}
          </a>
        ) : null}
        <EnquiryStatusActions
          enquiryId={enquiry.id}
          status={enquiry.status}
          customerName={customer.name}
        />
      </div>
    </li>
  );
}
