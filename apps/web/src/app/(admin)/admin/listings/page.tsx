import type { ModerationQueueResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, Tag } from '@/components/ui/primitives';
import { QueueApproveButton } from '@/features/admin/queue-actions';
import { apiGet, qs } from '@/lib/api';
import type { SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Listing moderation' };

/** DESIGN-SPEC §3.17 — the moderation queue. */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : 'PENDING_REVIEW';

  const queue = await apiGet<ModerationQueueResponse>(
    `/v1/admin/listings${qs({ status, limit: 50 })}`,
    { revalidate: false },
  );

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">Listing moderation</h1>
        <span className="text-[14px] ink-muted tnum">{queue.pendingCount} pending</span>
        {queue.oldestWaitingLabel ? (
          <span className="text-[12px] ink-subtle">
            oldest waiting <span className="tnum">{queue.oldestWaitingLabel}</span>
          </span>
        ) : null}
      </div>

      {queue.data.length === 0 ? (
        <EmptyState
          title="Queue clear"
          message="Nothing is waiting for review. Submitted listings appear here within seconds."
        />
      ) : (
        <div className="overflow-x-auto border border-(--color-divider) bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Dealer</th>
                <th>Price</th>
                <th>Location</th>
                <th>Submitted</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.data.map((row) => (
                <tr key={row.listingId}>
                  <td>
                    <div className="flex items-center gap-[10px]">
                      <span className="h-[33px] w-[44px] flex-none overflow-hidden border border-(--color-divider) bg-(--color-surface)">
                        {row.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{row.title}</div>
                        <div className="text-[11px] ink-subtle tnum">
                          {row.kmLabel} · {row.fuelLabel} · {row.transmissionLabel} ·{' '}
                          {row.photoCount} photos
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-[13px]">{row.dealer.brandName}</div>
                    {row.flags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <Tag key={flag.code} className="text-[10px]">
                            {flag.message}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="tnum">{row.priceLabel}</td>
                  <td>{row.city}</td>
                  <td className="whitespace-nowrap tnum">{row.submittedLabel}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link
                      href={`/admin/listings/${row.listingId}`}
                      className="btn btn-secondary mr-[6px] text-[12px]"
                    >
                      Review
                    </Link>
                    <QueueApproveButton listingId={row.listingId} title={row.title} />
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
