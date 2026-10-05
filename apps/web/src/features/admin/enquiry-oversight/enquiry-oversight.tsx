import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';

import { ENQUIRY_OVERSIGHT_TEXT } from './enquiry-oversight.constants';
import { EnquiryOversightFilters } from './enquiry-oversight-filters';
import { EnquiryOversightRow } from './enquiry-oversight-row';
import { EnquiryOversightTabs } from './enquiry-oversight-tabs';
import type { EnquiryOversightProps } from './enquiry-oversight.types';
import { isFiltered, oversightHref } from './utils';

const COLUMNS: TableColumn[] = [
  { key: 'customer', label: ENQUIRY_OVERSIGHT_TEXT.colCustomer },
  { key: 'vehicle', label: ENQUIRY_OVERSIGHT_TEXT.colVehicle },
  { key: 'dealer', label: ENQUIRY_OVERSIGHT_TEXT.colDealer },
  { key: 'message', label: ENQUIRY_OVERSIGHT_TEXT.colMessage, className: 'max-xl:hidden' },
  { key: 'status', label: ENQUIRY_OVERSIGHT_TEXT.colStatus },
  { key: 'received', label: ENQUIRY_OVERSIGHT_TEXT.colReceived },
  { key: 'actions', label: ENQUIRY_OVERSIGHT_TEXT.colActions, align: 'right' },
];

export function EnquiryOversight({ enquiries, filters }: EnquiryOversightProps) {
  const narrowed = isFiltered(filters) || filters.status !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[26px]">{ENQUIRY_OVERSIGHT_TEXT.title}</h1>
          <span className="text-[13px] ink-muted tnum">
            {ENQUIRY_OVERSIGHT_TEXT.total(enquiries.counts.ALL)}
          </span>
        </div>
        <p className="max-w-[72ch] text-[13px] ink-muted">{ENQUIRY_OVERSIGHT_TEXT.intro}</p>
      </div>

      <EnquiryOversightTabs counts={enquiries.counts} filters={filters} />
      <EnquiryOversightFilters filters={filters} dealerName={enquiries.dealer?.name ?? null} />

      {enquiries.data.length === 0 ? (
        narrowed ? (
          <EmptyState
            title={ENQUIRY_OVERSIGHT_TEXT.filteredEmptyTitle}
            message={ENQUIRY_OVERSIGHT_TEXT.filteredEmptyMessage}
          />
        ) : (
          <EmptyState
            title={ENQUIRY_OVERSIGHT_TEXT.emptyTitle}
            message={ENQUIRY_OVERSIGHT_TEXT.emptyMessage}
          />
        )
      ) : (
        <Table columns={COLUMNS} caption={ENQUIRY_OVERSIGHT_TEXT.caption}>
          {enquiries.data.map((row) => (
            <EnquiryOversightRow key={row.id} row={row} filters={filters} />
          ))}
        </Table>
      )}

      {enquiries.page.nextCursor ? (
        <Link
          href={oversightHref({ ...filters, cursor: enquiries.page.nextCursor })}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{ENQUIRY_OVERSIGHT_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
