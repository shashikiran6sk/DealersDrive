import { PublicVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AppliedFilters } from '@/components/search/applied-filters';
import { DistrictScope } from '@/components/search/district-scope';
import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { SearchToolbar } from '@/components/search/search-toolbar';
import {
  SearchNavigationProvider,
  SearchResultsRegion,
} from '@/components/search/search-navigation';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { getPublicLocations } from '@/lib/locations';
import { seoMetadata } from '@/lib/seo';
import type { SearchParamsInput } from '@/lib/url';
import {
  activeFilterCount,
  clearFilters,
  readVehicleSearch,
  searchHref,
  setParam,
} from '@/lib/vehicle-search';

import { CARS_TEXT } from './cars.constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: CARS_TEXT.metaTitle,
  description: CARS_TEXT.metaDescription,
  ...seoMetadata({ kind: 'resolved', canonical: '/cars', isIndexable: true }),
};

const CARS_PATH = '/cars';

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = readVehicleSearch(await searchParams);
  const [listing, locations] = await Promise.all([
    apiGetParsed(PublicVehiclesResponse, `/v1/vehicles${qs(params)}`, {
      revalidate: 60,
      tags: [VEHICLES_TAG],
    }),
    getPublicLocations(),
  ]);

  const district = params.district;
  const place = district
    ? (locations.districts.find((entry) => entry.slug === district)?.name ?? district)
    : undefined;
  const filtered = activeFilterCount(params) > 0 || Boolean(params.q);
  const pageHref = (page: number) => searchHref(CARS_PATH, setParam(params, 'page', String(page)));

  return (
    <SearchNavigationProvider>
      <div className="mx-auto max-w-[1280px] px-6 pt-[26px] pb-[60px]">
        <nav className="mb-[10px] text-[12px] ink-subtle" aria-label={CARS_TEXT.breadcrumbLabel}>
          <Link href="/">{CARS_TEXT.home}</Link> / {CARS_TEXT.breadcrumb}
        </nav>

        <div className="mb-[10px] flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[34px]">{place ? CARS_TEXT.titleIn(place) : CARS_TEXT.title}</h1>
            <span className="text-[14px] ink-muted tnum" role="status">
              {CARS_TEXT.count(listing.page.total)}
            </span>
          </div>
          <SearchToolbar
            params={params}
            basePath={CARS_PATH}
            leading={
              <MobileFilterSheet
                key="filters"
                facets={listing.facets}
                params={params}
                basePath={CARS_PATH}
                total={listing.page.total}
              />
            }
          />
        </div>

        <div className="mb-[14px] flex flex-col gap-[10px]">
          <DistrictScope locations={locations} />
          <AppliedFilters facets={listing.facets} params={params} basePath={CARS_PATH} />
        </div>

        <div className="grid gap-[22px] lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside
            className="hidden lg:sticky lg:top-[84px] lg:block lg:self-start"
            aria-label={CARS_TEXT.filtersLabel}
          >
            <FilterPanel facets={listing.facets} params={params} basePath={CARS_PATH} />
          </aside>

          <SearchResultsRegion>
            {listing.data.length > 0 ? (
              <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
                {listing.data.map((vehicle, index) => (
                  <VehicleCard key={vehicle.slug} vehicle={vehicle} priority={index < 4} />
                ))}
              </div>
            ) : filtered ? (
              <EmptyState
                title={place ? CARS_TEXT.emptyFilteredInTitle(place) : CARS_TEXT.emptyFilteredTitle}
                message={CARS_TEXT.emptyFilteredMessage}
                action={
                  <Link
                    href={searchHref(CARS_PATH, clearFilters(setParam(params, 'q', undefined)))}
                    className="btn btn-primary"
                  >
                    {CARS_TEXT.emptyFilteredAction}
                  </Link>
                }
              />
            ) : place ? (
              <EmptyState
                title={CARS_TEXT.emptyInTitle(place)}
                message={CARS_TEXT.emptyInMessage(place)}
                action={
                  <Link href={CARS_PATH} className="btn btn-primary">
                    {CARS_TEXT.emptyInAction}
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={CARS_TEXT.emptyTitle}
                message={CARS_TEXT.emptyMessage}
                action={
                  <Link href="/dealers" className="btn btn-primary">
                    {CARS_TEXT.emptyAction}
                  </Link>
                }
              />
            )}

            {listing.page.totalPages > 1 ? (
              <nav
                className="mt-6 flex items-center justify-between gap-3"
                aria-label={CARS_TEXT.pagination}
              >
                {listing.page.page > 1 ? (
                  <Link
                    href={pageHref(listing.page.page - 1)}
                    rel="prev"
                    className="btn btn-secondary"
                  >
                    {CARS_TEXT.previous}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-[13px] ink-subtle tnum">
                  {CARS_TEXT.pageOf(listing.page.page, listing.page.totalPages)}
                </span>
                {listing.page.page < listing.page.totalPages ? (
                  <Link
                    href={pageHref(listing.page.page + 1)}
                    rel="next"
                    className="btn btn-secondary"
                  >
                    {CARS_TEXT.next}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </SearchResultsRegion>
        </div>
      </div>
    </SearchNavigationProvider>
  );
}
