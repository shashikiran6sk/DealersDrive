import Link from 'next/link';

import { Input } from '@/components/ui/input';

import { ENQUIRY_OVERSIGHT_TEXT } from './enquiry-oversight.constants';
import type { EnquiryOversightFilters as Filters } from './enquiry-oversight.types';
import { isFiltered, oversightHref } from './utils';
import { LinkPendingLabel } from '@/components/ui/link-pending';

export function EnquiryOversightFilters({
  filters,
  dealerName,
}: {
  filters: Filters;
  dealerName: string | null;
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <form
        method="get"
        action={oversightHref({})}
        role="search"
        aria-label={ENQUIRY_OVERSIGHT_TEXT.filtersLabel}
        className="flex flex-wrap items-end gap-[10px]"
      >
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {filters.dealer ? <input type="hidden" name="dealer" value={filters.dealer} /> : null}

        <label className="flex min-w-[220px] max-md:min-w-0 max-md:max-w-full flex-1 flex-col gap-[4px] text-[11px] uppercase tracking-[0.08em] ink-subtle sm:max-w-[320px]">
          {ENQUIRY_OVERSIGHT_TEXT.searchLabel}
          <Input
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            placeholder={ENQUIRY_OVERSIGHT_TEXT.searchPlaceholder}
            maxLength={120}
            className="text-[13px] normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-[4px] text-[11px] uppercase tracking-[0.08em] ink-subtle">
          {ENQUIRY_OVERSIGHT_TEXT.fromLabel}
          <Input
            name="from"
            type="date"
            defaultValue={filters.from ?? ''}
            className="text-[13px] normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-[4px] text-[11px] uppercase tracking-[0.08em] ink-subtle">
          {ENQUIRY_OVERSIGHT_TEXT.toLabel}
          <Input
            name="to"
            type="date"
            defaultValue={filters.to ?? ''}
            className="text-[13px] normal-case tracking-normal"
          />
        </label>

        <button type="submit" className="btn btn-secondary">
          {ENQUIRY_OVERSIGHT_TEXT.apply}
        </button>
        {isFiltered(filters) ? (
          <Link
            href={oversightHref({ status: filters.status })}
            className="relative btn btn-ghost text-[12px]"
          >
            <LinkPendingLabel>{ENQUIRY_OVERSIGHT_TEXT.clear}</LinkPendingLabel>
          </Link>
        ) : null}
      </form>

      {filters.dealer ? (
        <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
          <span className="ink-muted">{ENQUIRY_OVERSIGHT_TEXT.dealerFilter}</span>
          <Link
            href={oversightHref({ ...filters, dealer: undefined })}
            aria-label={ENQUIRY_OVERSIGHT_TEXT.removeDealer(dealerName ?? filters.dealer)}
            className="relative dd-chip no-underline"
            aria-current="true"
          >
            <LinkPendingLabel>
              {dealerName ?? ENQUIRY_OVERSIGHT_TEXT.unknownDealer(filters.dealer)}
              <span aria-hidden="true">×</span>
            </LinkPendingLabel>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
