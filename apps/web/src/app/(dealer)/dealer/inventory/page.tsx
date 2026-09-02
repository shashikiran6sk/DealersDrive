import type { InventoryResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Banner, EmptyState, StatusTag } from '@/components/ui/primitives';
import { InventoryActions } from '@/features/vehicle/inventory-actions';
import { apiGet, qs } from '@/lib/api';
import type { SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Inventory' };

/**
 * DESIGN-SPEC §3.13.
 *
 * A desktop table and, below 768, the same rows as cards. Every column here is
 * a label the API composed — `statusLabel`/`statusTone` in particular, because
 * the display status is derived from the vehicle *and* the listing and must be
 * computed once, in one place (ARCHITECTURE §7.2).
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : undefined;

  const inventory = await apiGet<InventoryResponse>(
    `/v1/dealer/vehicles${qs({ status, limit: 50 })}`,
    { revalidate: false },
  );

  return (
    <div className="flex flex-col gap-[18px] p-[22px]">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">Inventory</h1>
        <span className="text-[14px] ink-muted tnum">{inventory.countLabel}</span>
      </div>

      {inventory.banner ? (
        <Banner
          tone={inventory.banner.type === 'REJECTED' ? 'err' : 'warn'}
          title={inventory.banner.title}
          action={
            <Link href={inventory.banner.actionHref} className="btn btn-secondary text-[12px]">
              {inventory.banner.actionLabel}
            </Link>
          }
        >
          {inventory.banner.reason}
        </Banner>
      ) : null}

      {inventory.data.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          message="Add your first car and it will go to review. Approved listings appear on the marketplace within the hour."
          action={
            <Link href="/dealer/vehicles/new" className="btn btn-primary">
              Add a vehicle
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table. */}
          <div className="hidden overflow-x-auto border border-(--color-divider) bg-white md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Enq.</th>
                  <th>Expires</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.data.map((row) => (
                  <tr key={row.vehicleId}>
                    <td>
                      <div className="flex items-center gap-[10px]">
                        <Thumb row={row} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium">{row.title}</div>
                          <div className="text-[11px] ink-subtle tnum">{row.metaLabel}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tnum">{row.priceLabel}</td>
                    <td>
                      <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
                    </td>
                    <td className="tnum">{row.views}</td>
                    <td className="tnum">{row.enquiries}</td>
                    <td className="whitespace-nowrap tnum">{row.expiryLabel}</td>
                    <td className="text-right">
                      <InventoryActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list, below 768. */}
          <div className="flex flex-col gap-[10px] md:hidden">
            {inventory.data.map((row) => (
              <div key={row.vehicleId} className="card gap-[10px] p-3">
                <div className="flex items-start gap-3">
                  <Thumb row={row} large />
                  <div className="min-w-0 flex-1">
                    {/* Only the title is the link. The card cannot be one any
                        more: it now contains buttons, and a button inside an
                        anchor is invalid and unreliable on touch. */}
                    <Link
                      href={`/dealer/vehicles/${row.vehicleId}/edit`}
                      className="text-[14px] font-medium"
                    >
                      {row.title}
                    </Link>
                    <div className="text-[13px] tnum">{row.priceLabel}</div>
                  </div>
                  <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
                </div>
                <div className="flex gap-4 border-t border-(--color-divider) pt-[9px] text-[11px] ink-muted tnum">
                  <span>{row.views} views</span>
                  <span>{row.enquiries} enquiries</span>
                  <span className="ml-auto">{row.expiryLabel}</span>
                </div>
                <div className="border-t border-(--color-divider) pt-[9px]">
                  <InventoryActions row={row} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 44×33 in the table, 70×52 in the card list (§2.13, §3.13). */
function Thumb({
  row,
  large = false,
}: {
  row: InventoryResponse['data'][number];
  large?: boolean;
}) {
  const size = large ? 'h-[52px] w-[70px]' : 'h-[33px] w-[44px]';

  return (
    <span
      className={`${size} flex-none overflow-hidden border border-(--color-divider) bg-(--color-surface)`}
    >
      {row.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}
