import type { PublicVehiclesResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { AppliedFilters } from '@/components/search/applied-filters';
import { FilterPanel, PORTFOLIO_FILTER_GROUPS } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import {
  SearchNavigationProvider,
  SearchResultsRegion,
} from '@/components/search/search-navigation';
import { SearchToolbar } from '@/components/search/search-toolbar';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import {
  activeFilterCount,
  clearFilters,
  searchHref,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import { DEALER_INVENTORY_TEXT, INVENTORY_ANCHOR } from './dealer-inventory.constants';
import { pageHref, portfolioPath } from './utils';

export interface DealerInventoryProps {
  dealerSlug: string;
  brandName: string;
  inventory: PublicVehiclesResponse;
  params?: VehicleSearchParams;
  liveTotal?: number;
  location?: string | null;
}

export function DealerInventory({
  dealerSlug,
  brandName,
  inventory,
  params = {},
  liveTotal = inventory.available,
  location = null,
}: DealerInventoryProps) {
  const { page, facets, available } = inventory;
  const basePath = portfolioPath(dealerSlug);
  const filtered = activeFilterCount(params) > 0;
  const total = filtered ? Math.max(liveTotal, available) : available;
  const hasStock = total > 0 || page.total > 0;

  return (
    <SearchNavigationProvider>
      <section
        id={INVENTORY_ANCHOR}
        aria-labelledby="inventory-heading"
        className="mx-auto max-w-[1280px] scroll-mt-[84px] px-6 pt-[26px] pb-[60px]"
      >
        <div
          className={hasStock ? 'grid gap-[22px] lg:grid-cols-[234px_minmax(0,1fr)]' : undefined}
        >
          {hasStock ? (
            <aside
              className="hidden lg:block lg:filter-rail"
              aria-label={DEALER_INVENTORY_TEXT.filtersLabel}
            >
              <FilterPanel
                facets={facets}
                params={params}
                basePath={basePath}
                groups={PORTFOLIO_FILTER_GROUPS}
                heading={DEALER_INVENTORY_TEXT.filtersHeading}
                idPrefix="inventory"
              />
            </aside>
          ) : null}

          <div className="min-w-0">
            <div className="mb-[12px] flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 id="inventory-heading" className="text-[28px]">
                  {DEALER_INVENTORY_TEXT.heading}
                </h2>
                <span className="text-[14px] ink-muted tnum" role="status">
                  {filtered
                    ? DEALER_INVENTORY_TEXT.countOf(available, total)
                    : DEALER_INVENTORY_TEXT.count(available)}
                </span>
              </div>
              {hasStock ? (
                <SearchToolbar
                  params={params}
                  basePath={basePath}
                  showSearch={false}
                  idPrefix="inventory"
                  leading={
                    <MobileFilterSheet
                      key="filters"
                      facets={facets}
                      params={params}
                      basePath={basePath}
                      total={page.total}
                      groups={PORTFOLIO_FILTER_GROUPS}
                    />
                  }
                />
              ) : null}
            </div>

            {location ? (
              <p className="mb-[12px] text-[13px] ink-subtle">
                {DEALER_INVENTORY_TEXT.locationLabel}{' '}
                <span className="font-medium ink-secondary">{location}</span>
              </p>
            ) : null}

            <div className="mb-[14px]">
              <AppliedFilters facets={facets} params={params} basePath={basePath} />
            </div>

            <SearchResultsRegion>
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
              ) : filtered ? (
                <EmptyState
                  title={DEALER_INVENTORY_TEXT.emptyFilteredTitle}
                  message={DEALER_INVENTORY_TEXT.emptyFilteredMessage(brandName)}
                  action={
                    <Link
                      href={`${searchHref(basePath, clearFilters(params))}#${INVENTORY_ANCHOR}`}
                      className="btn btn-primary"
                    >
                      {DEALER_INVENTORY_TEXT.emptyFilteredAction}
                    </Link>
                  }
                />
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
                      href={pageHref(dealerSlug, params, page.page - 1)}
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
                      href={pageHref(dealerSlug, params, page.page + 1)}
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
            </SearchResultsRegion>
          </div>
        </div>
      </section>
    </SearchNavigationProvider>
  );
}
