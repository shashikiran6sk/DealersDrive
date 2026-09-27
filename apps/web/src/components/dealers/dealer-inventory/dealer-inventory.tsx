import type { PublicVehiclesResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';

import { DEALER_INVENTORY_TEXT, INVENTORY_ANCHOR } from './dealer-inventory.constants';
import { pageHref } from './utils';

export interface DealerInventoryProps {
  dealerSlug: string;
  brandName: string;
  inventory: PublicVehiclesResponse;
}

export function DealerInventory({ dealerSlug, brandName, inventory }: DealerInventoryProps) {
  const { page } = inventory;

  return (
    <section
      id={INVENTORY_ANCHOR}
      aria-labelledby="inventory-heading"
      className="mx-auto max-w-[1280px] scroll-mt-[84px] px-6 pt-[26px] pb-[60px]"
    >
      <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
        <h2 id="inventory-heading" className="text-[28px]">
          {DEALER_INVENTORY_TEXT.heading}
        </h2>
        <span className="text-[14px] ink-muted tnum">
          {DEALER_INVENTORY_TEXT.count(page.total)}
        </span>
      </div>

      {inventory.data.length > 0 ? (
        <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {inventory.data.map((vehicle, index) => (
            <VehicleCard
              key={vehicle.slug}
              vehicle={vehicle}
              variant="compact"
              priority={page.page === 1 && index < 4}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={DEALER_INVENTORY_TEXT.emptyTitle}
          message={DEALER_INVENTORY_TEXT.emptyMessage(brandName)}
          action={
            <Link href="/cars" className="btn btn-primary">
              {DEALER_INVENTORY_TEXT.emptyAction}
            </Link>
          }
        />
      )}

      {page.totalPages > 1 ? (
        <nav
          className="mt-6 flex items-center justify-between gap-3"
          aria-label={DEALER_INVENTORY_TEXT.pagination}
        >
          {page.page > 1 ? (
            <Link
              href={pageHref(dealerSlug, page.page - 1)}
              rel="prev"
              className="btn btn-secondary"
            >
              {DEALER_INVENTORY_TEXT.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] ink-subtle tnum">
            {DEALER_INVENTORY_TEXT.pageOf(page.page, page.totalPages)}
          </span>
          {page.page < page.totalPages ? (
            <Link
              href={pageHref(dealerSlug, page.page + 1)}
              rel="next"
              className="btn btn-secondary"
            >
              {DEALER_INVENTORY_TEXT.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
