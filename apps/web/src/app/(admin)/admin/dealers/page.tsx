import type { AdminDealersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { NumericCell, Table, type TableColumn } from '@/components/ui/table';
import { apiGet, qs } from '@/lib/api';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealers' };

/**
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline types `searchParams` as `SearchParamsInput` from `lib/url.ts`.
 * That file is the search-state-in-the-URL policy and belongs to **F077**; the
 * type itself is the literal below, so it is inlined here rather than dragging
 * `FACET_ORDER` and `buildSearchUrl` forward for one alias.
 * ────────────────────────────────────────────────────────────────────────────
 */
type SearchParamsInput = Record<string, string | string[] | undefined>;

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

/** DESIGN-SPEC §3.17, plus the district and state the location filter works in. */
const COLUMNS: TableColumn[] = [
  { key: 'dealer', label: 'Dealer' },
  { key: 'city', label: 'City' },
  { key: 'district', label: 'District' },
  { key: 'state', label: 'State' },
  { key: 'status', label: 'Status' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'active', label: 'Active' },
  { key: 'credits', label: 'Credits' },
  { key: 'joined', label: 'Joined' },
  { key: 'actions', label: 'Actions', align: 'right' },
];

/** A single-valued search parameter, or nothing. */
function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export default async function AdminDealersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = one(params, 'status');
  const state = one(params, 'state');
  const district = one(params, 'district');
  const city = one(params, 'city');

  const dealers = await apiGet<AdminDealersResponse>(
    `/v1/admin/dealers${qs({ status, state, district, city, limit: 50 })}`,
    { revalidate: false },
  );

  /**
   * The status tabs have to carry the location filter with them, and the
   * location form has to carry the status tab. Otherwise every click on either
   * one silently discards the other, and an operator who has narrowed to a
   * district loses it the moment they look at the pending tab.
   */
  const tabHref = (value?: string) =>
    `/admin/dealers${qs({ status: value, state, district, city })}`;

  return (
    <div className="flex flex-col gap-4 p-5">
      <h1 className="text-[26px]">Dealers</h1>

      {/*
        The counts come back with the page, so the tabs cost no second request —
        and cannot disagree with the list they filter.
      */}
      <div className="seg self-start">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tabHref(tab.value)}
            aria-selected={status === tab.value}
            className={cn('seg-opt no-underline')}
          >
            <span className="tnum">
              {tab.label}
              {tab.value && dealers.counts[tab.value] !== undefined
                ? ` (${dealers.counts[tab.value]})`
                : ''}
            </span>
          </Link>
        ))}
      </div>

      {/*
        Where, in three fields, narrowing from the outside in.

        A plain GET `<form>`: the filter belongs in the URL, so a moderator can
        send "every pending dealer in Vellore district" to a colleague as a
        link, and the page stays a server component with no client JavaScript at
        all. The options come from the response's own `facets`, so the filter
        can only ever offer a place some dealership is actually in — and they
        are not narrowed by the current selection, which is what stops a state
        choice from emptying the district list and stranding the operator.
      */}
      <form method="get" action="/admin/dealers" className="flex flex-wrap items-end gap-[10px]">
        {/* The tab, carried through the submit rather than reset by it. */}
        {status ? <input type="hidden" name="status" value={status} /> : null}

        <LocationFilter name="state" label="State" value={state} options={dealers.facets.states} />
        <LocationFilter
          name="district"
          label="District"
          value={district}
          options={dealers.facets.districts}
        />
        <LocationFilter name="city" label="City" value={city} options={dealers.facets.cities} />

        <button type="submit" className="btn btn-secondary h-[36px] px-[16px] text-[13px]">
          Filter
        </button>

        {/*
          Clear drops the three location fields and keeps the status tab —
          `tabHref` is the wrong helper here, because its whole job is to carry
          the location through.
        */}
        {state || district || city ? (
          <Link
            href={`/admin/dealers${qs({ status })}`}
            className="btn btn-ghost h-[36px] px-[12px] text-[12px]"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {dealers.data.length === 0 ? (
        <EmptyState title="No dealers here" message="Nothing matches this filter." />
      ) : (
        <Table columns={COLUMNS} caption="Every dealership on the platform">
          {dealers.data.map((dealer) => (
            <tr key={dealer.id}>
              <td>
                <div className="text-[13px] font-medium">{dealer.brandName}</div>
                <div className="text-[11px] ink-subtle">
                  {dealer.documentsVerified ? 'Documents verified' : 'Documents pending'}
                </div>
              </td>
              <td>{dealer.city}</td>
              <td>{dealer.district}</td>
              <td>{dealer.state}</td>
              <td>
                <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
              </td>
              <NumericCell>{dealer.vehicleCount}</NumericCell>
              <NumericCell>{dealer.activeCount}</NumericCell>
              <NumericCell>{dealer.creditBalance}</NumericCell>
              <NumericCell className="whitespace-nowrap">{dealer.joinedLabel}</NumericCell>
              <td className="whitespace-nowrap text-right">
                <Link href={`/admin/dealers/${dealer.id}`} className="btn btn-ghost text-[12px]">
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/**
 * One `<select>` of places, plus its label.
 *
 * It is a function in this file rather than a component in `components/ui`
 * because it is three lines of markup with no state, no variants and exactly
 * one consumer — the sandbox exists to stop the *fifth* hand-rolled copy of
 * something, not to receive the first. `select.input` is the shared style; a
 * new one would have been the actual duplication.
 */
function LocationFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-[4px] text-[11px] uppercase tracking-[0.08em] ink-subtle">
      {label}
      <select name={name} defaultValue={value ?? ''} className="input min-w-[160px] text-[13px]">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
