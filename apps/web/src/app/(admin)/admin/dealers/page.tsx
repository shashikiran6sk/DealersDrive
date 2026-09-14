import type { AdminDealersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { NumericCell, Table, type TableColumn } from '@/components/ui/table';
import { apiGet, qs } from '@/lib/api';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealers' };

type SearchParamsInput = Record<string, string | string[] | undefined>;

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

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
  const pendingEdits = one(params, 'pendingEdits') === 'true' ? 'true' : undefined;

  const dealers = await apiGet<AdminDealersResponse>(
    `/v1/admin/dealers${qs({ status, state, district, city, pendingEdits, limit: 50 })}`,
    { revalidate: false },
  );

  const tabHref = (value?: string) =>
    `/admin/dealers${qs({ status: value, state, district, city, pendingEdits })}`;

  return (
    <div className="flex flex-col gap-4 p-5">
      <h1 className="text-[26px]">Dealers</h1>

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

      <form method="get" action="/admin/dealers" className="flex flex-wrap items-end gap-[10px]">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {pendingEdits ? <input type="hidden" name="pendingEdits" value="true" /> : null}

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

        {state || district || city ? (
          <Link
            href={`/admin/dealers${qs({ status, pendingEdits })}`}
            className="btn btn-ghost h-[36px] px-[12px] text-[12px]"
          >
            Clear
          </Link>
        ) : null}

        <Link
          href={`/admin/dealers${qs({
            status,
            state,
            district,
            city,
            pendingEdits: pendingEdits ? undefined : 'true',
          })}`}
          aria-pressed={Boolean(pendingEdits)}
          className={cn(
            'btn h-[36px] px-[12px] text-[12px]',
            pendingEdits ? 'btn-primary' : 'btn-ghost',
          )}
        >
          Waiting on review
        </Link>
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
                {dealer.hasPendingProfileEdit ? (
                  <div className="mt-[3px] text-[11px] font-semibold text-(--color-warn)">
                    Profile edit waiting
                  </div>
                ) : null}
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
