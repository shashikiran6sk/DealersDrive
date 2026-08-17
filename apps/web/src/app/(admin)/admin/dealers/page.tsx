import type { AdminDealersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { apiGet, qs } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealers' };

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

/** DESIGN-SPEC §3.17 — Dealer / City / Status / Vehicles / Active / Joined / Manage. */
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
        <div className="overflow-x-auto border border-(--color-divider) bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Dealer</th>
                <th>City</th>
                <th>Status</th>
                <th>Vehicles</th>
                <th>Active</th>
                <th>Credits</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
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
                  <td className="tnum">{dealer.vehicleCount}</td>
                  <td className="tnum">{dealer.activeCount}</td>
                  <td className="tnum">{dealer.creditBalance}</td>
                  <td className="whitespace-nowrap tnum">{dealer.joinedLabel}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={`/admin/dealers/${dealer.id}`}
                      className="btn btn-ghost text-[12px]"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
