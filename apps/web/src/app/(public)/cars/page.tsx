import { PublicVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';

import { AppliedFilters } from '@/components/search/applied-filters';
import { CarSearchBox } from '@/components/search/car-search-box';
import { DistrictScope } from '@/components/search/district-scope';
import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { SearchToolbar } from '@/components/search/search-toolbar';
import {
  SearchNavigationProvider,
  SearchResultsRegion,
} from '@/components/search/search-navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { getPublicLocations } from '@/lib/locations';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  directoryView,
  isIndexableView,
  itemListSchema,
  pageMetadata,
  vehiclePath,
} from '@/lib/seo';
import type { SearchParamsInput } from '@/lib/url';
import {
  activeFilterCount,
  clearFilters,
  readVehicleSearch,
  searchHref,
  setParam,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import { CARS_TEXT } from './cars.constants';

export const dynamic = 'force-dynamic';

const CARS_PATH = '/cars';

const fetchCars = cache((query: string) =>
  apiGetParsed(PublicVehiclesResponse, `/v1/vehicles${query}`, {
    revalidate: 60,
    tags: [VEHICLES_TAG],
  }),
);

async function loadCars(params: VehicleSearchParams) {
  const [listing, locations] = await Promise.all([fetchCars(qs(params)), getPublicLocations()]);
  const district = params.district;
  const place = district
    ? (locations.districts.find((entry) => entry.slug === district)?.name ?? district)
    : undefined;
  return { listing, locations, place, view: directoryView(params, listing.data.length === 0) };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const { place, view } = await loadCars(readVehicleSearch(await searchParams));
  return pageMetadata({
    title: CARS_TEXT.metaTitle(place, view.page ?? 1),
    description: CARS_TEXT.metaDescription(place),
    route: { kind: 'cars', ...view },
  });
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = readVehicleSearch(await searchParams);
  const { listing, locations, place, view } = await loadCars(params);

  const filtered = activeFilterCount(params) > 0 || Boolean(params.q);
  const pageHref = (page: number) => searchHref(CARS_PATH, setParam(params, 'page', String(page)));
  const listed = listing.data.filter((vehicle) => vehicle.availability === 'AVAILABLE');

  return (
    <SearchNavigationProvider>
      <JsonLd
        nodes={[
          breadcrumbSchema([
            { name: BREADCRUMB_TEXT.home, path: '/' },
            { name: BREADCRUMB_TEXT.cars, path: CARS_PATH },
          ]),
          ...(isIndexableView(view) && listed.length > 0
            ? [
                itemListSchema(
                  CARS_TEXT.listName(place),
                  listed.map((vehicle) => ({
                    name: vehicle.title,
                    path: vehiclePath(vehicle.slug),
                  })),
                  (listing.page.page - 1) * listing.page.limit,
                ),
              ]
            : []),
        ]}
      />
      <div className="mx-auto max-w-[1280px] px-4 pt-[28px] pb-[64px] sm:px-6">
        <nav className="mb-[10px] text-[12px] ink-subtle" aria-label={CARS_TEXT.breadcrumbLabel}>
          <Link href="/">{CARS_TEXT.home}</Link> / {CARS_TEXT.breadcrumb}
        </nav>

        <div className="mb-[14px] flex flex-wrap items-baseline gap-3">
          <h1 className="text-[26px] sm:text-[30px]">
            {place ? CARS_TEXT.titleIn(place) : CARS_TEXT.title}
          </h1>
          <span className="text-[14px] ink-muted tnum" role="status">
            {CARS_TEXT.count(listing.available)}
          </span>
        </div>

        <div
          role="group"
          aria-label={CARS_TEXT.controlsLabel}
          className="mb-[14px] flex flex-wrap items-center gap-2"
        >
          <CarSearchBox
            params={params}
            basePath={CARS_PATH}
            {...(place ? { districtName: place } : {})}
          />
          <DistrictScope locations={locations} />
          <SearchToolbar
            params={params}
            basePath={CARS_PATH}
            showSearch={false}
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

        <div className="mb-[14px] empty:hidden">
          <AppliedFilters facets={listing.facets} params={params} basePath={CARS_PATH} />
        </div>

        <div className="grid gap-[22px] lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden lg:block lg:filter-rail" aria-label={CARS_TEXT.filtersLabel}>
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
                    className="relative btn btn-primary"
                  >
                    <LinkPendingLabel>{CARS_TEXT.emptyFilteredAction}</LinkPendingLabel>
                  </Link>
                }
              />
            ) : place ? (
              <EmptyState
                title={CARS_TEXT.emptyInTitle(place)}
                message={CARS_TEXT.emptyInMessage(place)}
                action={
                  <Link href={CARS_PATH} className="relative btn btn-primary">
                    <LinkPendingLabel>{CARS_TEXT.emptyInAction}</LinkPendingLabel>
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={CARS_TEXT.emptyTitle}
                message={CARS_TEXT.emptyMessage}
                action={
                  <Link href="/dealers" className="relative btn btn-primary">
                    <LinkPendingLabel>{CARS_TEXT.emptyAction}</LinkPendingLabel>
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
                    className="relative btn btn-secondary"
                  >
                    <LinkPendingLabel>{CARS_TEXT.previous}</LinkPendingLabel>
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
                    className="relative btn btn-secondary"
                  >
                    <LinkPendingLabel>{CARS_TEXT.next}</LinkPendingLabel>
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
