import { PublicVehiclesResponse, type PublicLandingPagesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { RelatedSearches } from '@/components/search/related-searches';
import { JsonLd } from '@/components/seo/json-ld';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { apiGetParsed, qs } from '@/lib/api';
import { DEALERS_TAG, VEHICLES_TAG } from '@/lib/cache-tags';
import {
  districtCarsPath,
  getLandingPages,
  landingPagesEnabled,
  landingPath,
  landingSearch,
  relatedLandingGroups,
  resolveLanding,
  type LandingRoute,
} from '@/lib/landing';
import { LANDING_TEXT, type LandingNaming } from '@/lib/landing.constants';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  itemListSchema,
  pageMetadata,
  vehiclePath,
  type Crumb,
} from '@/lib/seo';
import { one, type SearchParamsInput } from '@/lib/url';
import { searchHref, type VehicleSearchParams } from '@/lib/vehicle-search';

import { USED_CARS_TEXT, type CountedName } from './used-cars.constants';

export const dynamic = 'force-dynamic';

type PageRoute = Extract<LandingRoute, { kind: 'page' }>;

interface Landing {
  kind: 'landing';
  route: PageRoute;
  map: PublicLandingPagesResponse;
  params: VehicleSearchParams;
  listing: PublicVehiclesResponse;
  page: number;
  path: string;
  naming: LandingNaming;
}

type Loaded = Landing | Exclude<LandingRoute, { kind: 'page' }>;

function pageNumber(query: SearchParamsInput): number {
  const page = Number(one(query, 'page') ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

const loadLanding = cache(async (key: string, page: number): Promise<Loaded> => {
  if (!(await landingPagesEnabled())) return { kind: 'not-found' };
  const map = await getLandingPages();
  if (!map) return { kind: 'not-found' };

  const route = resolveLanding(map, key.split('/'));
  if (route.kind !== 'page') return route;

  const params = landingSearch(route.place, route.facet);
  const listing = await apiGetParsed(
    PublicVehiclesResponse,
    `/v1/vehicles${qs({ ...params, ...(page > 1 ? { page: String(page) } : {}) })}`,
    { revalidate: 60, tags: [VEHICLES_TAG, DEALERS_TAG] },
  );
  if (page > listing.page.totalPages) return { kind: 'not-found' };

  return {
    kind: 'landing',
    route,
    map,
    params,
    listing,
    page,
    path: landingPath(route.place.slug, route.facet?.slug),
    naming: { kind: route.facet?.kind ?? null, label: route.label, place: route.place.name },
  };
});

async function landingFor(
  params: Promise<{ segments: string[] }>,
  searchParams: Promise<SearchParamsInput> | undefined,
): Promise<Landing> {
  const [{ segments }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const loaded = await loadLanding(segments.join('/'), pageNumber(query));
  if (loaded.kind === 'not-found') notFound();
  if (loaded.kind === 'redirect') permanentRedirect(loaded.to);
  return loaded;
}

function isIndexable({ listing, map }: Landing): boolean {
  return listing.available >= map.minCars && listing.data.length > 0;
}

function canonicalOf({ path, page }: Landing): string {
  return page > 1 ? `${path}?page=${String(page)}` : path;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams?: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const landing = await landingFor(params, searchParams);
  const count = landing.listing.available;
  const lead = landing.listing.data.find((vehicle) => vehicle.image)?.image;

  return pageMetadata({
    title: LANDING_TEXT.title(landing.naming, count, landing.page),
    description: LANDING_TEXT.description(landing.naming, count),
    route: { kind: 'resolved', canonical: canonicalOf(landing), isIndexable: isIndexable(landing) },
    ...(lead ? { images: [{ url: lead.url, alt: lead.alt }] } : {}),
  });
}

function crumbsOf({ route, path, naming }: Landing): Crumb[] {
  const { place, facet } = route;
  return [
    { name: BREADCRUMB_TEXT.home, path: '/' },
    { name: BREADCRUMB_TEXT.cars, path: '/cars' },
    { name: place.district.name, path: districtCarsPath(place.district.slug) },
    ...(place.kind === 'TOWN' && facet
      ? [{ name: place.name, path: landingPath(place.slug) }]
      : []),
    { name: LANDING_TEXT.name(naming), path },
  ];
}

function mostListed({ route, listing }: Landing): CountedName[] {
  if (route.facet?.kind === 'MODEL') return [];
  const options = route.facet?.kind === 'BRAND' ? listing.facets.models : listing.facets.brands;
  return options
    .filter((option) => option.count > 0)
    .map((option) => ({ label: option.label, count: option.count }));
}

function introOf(landing: Landing): string[] {
  const dealers = landing.listing.facets.dealers
    .filter((option) => option.count > 0)
    .map((option) => option.label);
  const listed = mostListed(landing);
  return [
    ...(dealers.length > 0 ? [USED_CARS_TEXT.listedBy(dealers)] : []),
    ...(listed.length > 1 ? [USED_CARS_TEXT.mostListed(listed)] : []),
    USED_CARS_TEXT.promise,
  ];
}

export default async function UsedCarsLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const landing = await landingFor(params, searchParams);
  const { route, map, listing, naming } = landing;
  const count = listing.available;
  const crumbs = crumbsOf(landing);
  const listed = listing.data.filter((vehicle) => vehicle.availability === 'AVAILABLE');
  const pageHref = (page: number) =>
    page > 1 ? `${landing.path}?page=${String(page)}` : landing.path;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-[28px] pb-[64px] sm:px-6">
      <JsonLd
        nodes={[
          breadcrumbSchema(crumbs),
          ...(isIndexable(landing) && listed.length > 0
            ? [
                itemListSchema(
                  LANDING_TEXT.name(naming),
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

      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label={USED_CARS_TEXT.breadcrumbLabel}>
        {crumbs.slice(0, -1).map((crumb) => (
          <span key={crumb.path}>
            <Link href={crumb.path}>{crumb.name}</Link>
            {' / '}
          </span>
        ))}
        <span aria-current="page">{crumbs[crumbs.length - 1]?.name}</span>
      </nav>

      <h1 className="text-[26px] sm:text-[30px]">
        {count > 0 ? LANDING_TEXT.heading(naming, count) : LANDING_TEXT.name(naming)}
      </h1>

      {count > 0 ? (
        <div className="mt-[10px] mb-[18px] flex max-w-[72ch] flex-col gap-[6px] text-[14px] leading-[1.6] ink-secondary">
          {introOf(landing).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      {listing.data.length > 0 ? (
        <>
          <div className="mb-[16px]">
            <Link href={searchHref('/cars', landing.params)} className="relative btn btn-secondary">
              <LinkPendingLabel>{USED_CARS_TEXT.refine}</LinkPendingLabel>
            </Link>
          </div>
          <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))] max-md:[grid-template-columns:repeat(auto-fill,minmax(min(258px,100%),1fr))]">
            {listing.data.map((vehicle, index) => (
              <VehicleCard key={vehicle.slug} vehicle={vehicle} priority={index < 4} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title={LANDING_TEXT.name(naming)}
          message={USED_CARS_TEXT.emptyMessage}
          action={
            <Link
              href={districtCarsPath(route.place.district.slug)}
              className="relative btn btn-primary"
            >
              <LinkPendingLabel>
                {USED_CARS_TEXT.emptyAction(route.place.district.name)}
              </LinkPendingLabel>
            </Link>
          }
        />
      )}

      {listing.page.totalPages > 1 ? (
        <nav
          className="mt-6 flex items-center justify-between gap-3"
          aria-label={USED_CARS_TEXT.pagination}
        >
          {listing.page.page > 1 ? (
            <Link
              href={pageHref(listing.page.page - 1)}
              rel="prev"
              className="relative btn btn-secondary"
            >
              <LinkPendingLabel>{USED_CARS_TEXT.previous}</LinkPendingLabel>
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] ink-subtle tnum">
            {USED_CARS_TEXT.pageOf(listing.page.page, listing.page.totalPages)}
          </span>
          {listing.page.page < listing.page.totalPages ? (
            <Link
              href={pageHref(listing.page.page + 1)}
              rel="next"
              className="relative btn btn-secondary"
            >
              <LinkPendingLabel>{USED_CARS_TEXT.next}</LinkPendingLabel>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <RelatedSearches
        className="mt-[44px]"
        heading={LANDING_TEXT.related(route.place.name)}
        groups={relatedLandingGroups(map, route.place, route.facet?.slug ?? null)}
      />
    </div>
  );
}
