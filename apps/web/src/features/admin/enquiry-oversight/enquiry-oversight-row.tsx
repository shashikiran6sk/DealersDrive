import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';

import { ENQUIRY_OVERSIGHT_PATH, ENQUIRY_OVERSIGHT_TEXT } from './enquiry-oversight.constants';
import type { EnquiryOversightRowProps } from './enquiry-oversight.types';
import { oversightHref } from './utils';

export function EnquiryOversightRow({ row, filters }: EnquiryOversightRowProps) {
  const { customer, dealer, vehicle } = row;

  return (
    <tr>
      <td className="min-w-[160px]">
        <div className="text-[13px] font-medium">{customer.name}</div>
        <div className="font-mono text-[11px] whitespace-nowrap ink-subtle tnum">
          {customer.phoneDisplay ?? ENQUIRY_OVERSIGHT_TEXT.noNumber}
        </div>
      </td>
      <td className="min-w-[180px]">
        <div className="text-[13px] font-medium">{vehicle.title}</div>
        <div className="flex flex-wrap items-center gap-[6px]">
          <span className="font-mono text-[11px] ink-subtle">{vehicle.registrationDisplay}</span>
          {vehicle.listingStatus !== 'ACTIVE' ? (
            <span className="text-[11px] ink-subtle">
              · {ENQUIRY_OVERSIGHT_TEXT.listing(vehicle.listingStatusLabel)}
            </span>
          ) : null}
        </div>
      </td>
      <td className="min-w-[140px]">
        <Link
          href={oversightHref({ ...filters, dealer: dealer.slug })}
          title={ENQUIRY_OVERSIGHT_TEXT.filterByDealer(dealer.name)}
          className="text-[13px]"
        >
          {dealer.name}
        </Link>
      </td>
      <td className="max-w-[260px] max-xl:hidden max-md:table-cell">
        <p className="m-0 truncate text-[12px] ink-muted" title={row.messagePreview ?? undefined}>
          {row.messagePreview || (
            <span className="ink-faint">{ENQUIRY_OVERSIGHT_TEXT.noMessage}</span>
          )}
        </p>
      </td>
      <td>
        <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
      </td>
      <td className="whitespace-nowrap">
        <time dateTime={row.createdAt} className="text-[12px] tnum">
          {row.createdLabel}
        </time>
      </td>
      <td className="text-right">
        <Link
          href={`${ENQUIRY_OVERSIGHT_PATH}/${row.id}`}
          aria-label={ENQUIRY_OVERSIGHT_TEXT.viewLabel(customer.name)}
          className="relative btn btn-secondary text-[12px]"
        >
          <LinkPendingLabel>{ENQUIRY_OVERSIGHT_TEXT.view}</LinkPendingLabel>
        </Link>
      </td>
    </tr>
  );
}
