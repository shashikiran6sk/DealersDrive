import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';

import { CUSTOMER_ENQUIRIES_TEXT } from './customer-enquiries.constants';
import type { CustomerEnquiryCardProps } from './customer-enquiries.types';

export function CustomerEnquiryCard({ enquiry }: CustomerEnquiryCardProps) {
  return (
    <li className="card flex flex-col gap-[10px] bg-white p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-[10px]">
        <div className="min-w-0">
          {enquiry.vehicle.href ? (
            <Link
              href={enquiry.vehicle.href}
              className="text-[16px] font-extrabold text-(--color-ink) hover:underline"
            >
              {enquiry.vehicle.title}
            </Link>
          ) : (
            <div className="text-[16px] font-extrabold">
              {enquiry.vehicle.title}{' '}
              <span className="text-[12px] font-normal ink-subtle">
                {CUSTOMER_ENQUIRIES_TEXT.noLongerListed}
              </span>
            </div>
          )}
          <div className="text-[13px] ink-muted">{enquiry.dealerName}</div>
        </div>
        <StatusTag tone={enquiry.statusTone}>{enquiry.statusLabel}</StatusTag>
      </div>
      <p className="m-0 text-[13px] whitespace-pre-line">
        {enquiry.message ?? <span className="ink-subtle">{CUSTOMER_ENQUIRIES_TEXT.noMessage}</span>}
      </p>
      <time
        dateTime={enquiry.createdAt}
        className="border-t border-(--color-divider) pt-[9px] text-[12px] ink-muted tnum"
      >
        {CUSTOMER_ENQUIRIES_TEXT.sentOn(enquiry.createdLabel)}
      </time>
    </li>
  );
}
