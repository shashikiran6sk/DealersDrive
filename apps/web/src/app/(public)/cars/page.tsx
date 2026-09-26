import { PublicVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { EmptyState } from '@/components/ui/primitives';
import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { seoMetadata } from '@/lib/seo';
import { one, type SearchParamsInput } from '@/lib/url';

import { CARS_TEXT } from './cars.constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: CARS_TEXT.metaTitle,
  description: CARS_TEXT.metaDescription,
  ...seoMetadata({ kind: 'resolved', canonical: '/cars', isIndexable: true }),
};

function pageOf(params: SearchParamsInput): number | undefined {
  const raw = Number(one(params, 'page'));
  return Number.isInteger(raw) && raw > 1 ? raw : undefined;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const page = pageOf(await searchParams);
  const listing = await apiGetParsed(PublicVehiclesResponse, `/v1/vehicles${qs({ page })}`, {
    revalidate: 60,
    tags: [VEHICLES_TAG],
  });

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-[26px] pb-[60px]">
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label={CARS_TEXT.breadcrumbLabel}>
        <Link href="/">{CARS_TEXT.home}</Link> / {CARS_TEXT.breadcrumb}
      </nav>

      <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
        <h1 className="text-[34px]">{CARS_TEXT.title}</h1>
        <span className="text-[14px] ink-muted tnum">{CARS_TEXT.count(listing.page.total)}</span>
      </div>

      {listing.data.length > 0 ? (
        <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
          {listing.data.map((vehicle, index) => (
            <VehicleCard key={vehicle.slug} vehicle={vehicle} priority={index < 4} />
          ))}
        </div>
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
              href={`/cars${qs({ page: listing.page.page > 2 ? listing.page.page - 1 : undefined })}`}
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
              href={`/cars${qs({ page: listing.page.page + 1 })}`}
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
