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

/** DESIGN-SPEC §3.17 — Dealer / City / Status / Vehicles / Active / Joined / Manage. */
const COLUMNS: TableColumn[] = [
  { key: 'dealer', label: 'Dealer' },
  { key: 'city', label: 'City' },
  { key: 'status', label: 'Status' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'active', label: 'Active' },
  { key: 'credits', label: 'Credits' },
  { key: 'joined', label: 'Joined' },
  { key: 'actions', label: 'Actions', align: 'right' },
];

export default async function AdminDealersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : undefined;

  const dealers = await apiGet<AdminDealersResponse>(
    `/v1/admin/dealers${qs({ status, limit: 50 })}`,
    { revalidate: false },
  );

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
            href={tab.value ? `/admin/dealers?status=${tab.value}` : '/admin/dealers'}
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
