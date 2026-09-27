import { PublicVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DistrictScope } from '@/components/search/district-scope';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { EmptyState } from '@/components/ui/primitives';
import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { getPublicLocations } from '@/lib/locations';
import { seoMetadata } from '@/lib/seo';
import { carsHref, one, type SearchParamsInput } from '@/lib/url';

import { CARS_TEXT } from './cars.constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: CARS_TEXT.metaTitle,
  description: CARS_TEXT.metaDescription,
  ...seoMetadata({ kind: 'resolved', canonical: '/cars', isIndexable: true }),
};

const DISTRICT_SLUG = /^[a-z0-9-]+$/;

function pageOf(params: SearchParamsInput): number | undefined {
  const raw = Number(one(params, 'page'));
  return Number.isInteger(raw) && raw > 1 ? raw : undefined;
}

function districtOf(params: SearchParamsInput): string | undefined {
  const raw = one(params, 'district');
  return raw && DISTRICT_SLUG.test(raw) ? raw : undefined;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const page = pageOf(params);
  const district = districtOf(params);
  const [listing, locations] = await Promise.all([
    apiGetParsed(PublicVehiclesResponse, `/v1/vehicles${qs({ district, page })}`, {
      revalidate: 60,
      tags: [VEHICLES_TAG],
    }),
    getPublicLocations(),
  ]);

  const place = district
    ? (locations.districts.find((entry) => entry.slug === district)?.name ?? district)
    : undefined;

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-[26px] pb-[60px]">
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label={CARS_TEXT.breadcrumbLabel}>
        <Link href="/">{CARS_TEXT.home}</Link> / {CARS_TEXT.breadcrumb}
      </nav>

      <div className="mb-[10px] flex flex-wrap items-baseline gap-3">
        <h1 className="text-[34px]">{place ? CARS_TEXT.titleIn(place) : CARS_TEXT.title}</h1>
        <span className="text-[14px] ink-muted tnum">{CARS_TEXT.count(listing.page.total)}</span>
      </div>

      <div className="mb-[18px]">
        <DistrictScope locations={locations} />
      </div>

      {listing.data.length > 0 ? (
        <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
          {listing.data.map((vehicle, index) => (
            <VehicleCard key={vehicle.slug} vehicle={vehicle} priority={index < 4} />
          ))}
        </div>
      ) : place ? (
        <EmptyState
          title={CARS_TEXT.emptyInTitle(place)}
          message={CARS_TEXT.emptyInMessage(place)}
          action={
            <Link href={carsHref({})} className="btn btn-primary">
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
              href={carsHref({ district, page: listing.page.page - 1 })}
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
              href={carsHref({ district, page: listing.page.page + 1 })}
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
    </div>
  );
}
