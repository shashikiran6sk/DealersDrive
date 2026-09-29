import type { DealerDirectoryResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DirectoryCard } from '@/components/dealers/dealer-card';
import { DirectoryFilters } from '@/components/dealers/directory-filters';
import { JsonLd } from '@/components/seo/json-ld';
import { EmptyState } from '@/components/ui/primitives';
import { apiGet, qs } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';
import { getPublicLocations } from '@/lib/locations';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  dealerPath,
  directoryView,
  isIndexableView,
  itemListSchema,
  pageMetadata,
} from '@/lib/seo';
import { many, one, type SearchParamsInput } from '@/lib/url';

import { DEALERS_TEXT } from './dealers.constants';

export const dynamic = 'force-dynamic';

function readParams(params: SearchParamsInput): {
  city: string[];
  district?: string;
  q?: string;
  page?: string;
} {
  return {
    city: many(params, 'city'),
    district: one(params, 'district'),
    q: one(params, 'q'),
    page: one(params, 'page'),
  };
}

function cityParam(city: string[]): string | undefined {
  return city.length > 0 ? [...city].sort().join(',') : undefined;
}

function loadDirectory(params: ReturnType<typeof readParams>): Promise<DealerDirectoryResponse> {
  const { city, district, q, page } = params;
  return apiGet<DealerDirectoryResponse>(
    `/v1/dealers${qs({ city: cityParam(city), district, q, page })}`,
    { revalidate: 600, tags: [DEALERS_TAG] },
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const params = readParams(await searchParams);
  const directory = await loadDirectory(params);
  const place = placeName(directory, params.city, params.district);
  const view = directoryView(params, directory.data.length === 0);

  return pageMetadata({
    title: DEALERS_TEXT.metaTitle(place, view.page ?? 1),
    description: DEALERS_TEXT.metaDescription(place),
    route: { kind: 'dealers', ...view },
  });
}

function placeName(
  directory: DealerDirectoryResponse,
  city: string[],
  district?: string,
): string | undefined {
  if (city.length === 1) {
    return directory.cities.find((entry) => entry.slug === city[0])?.name;
  }
  if (district) return directory.districts.find((entry) => entry.slug === district)?.name;
  return undefined;
}

export default async function DealerDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = readParams(await searchParams);
  const { city, district, q } = params;
  const [directory, locations] = await Promise.all([loadDirectory(params), getPublicLocations()]);

  const place = placeName(directory, city, district);
  const view = directoryView(params, directory.data.length === 0);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-[64px] pt-[28px] sm:px-6">
      <JsonLd
        nodes={[
          breadcrumbSchema([
            { name: BREADCRUMB_TEXT.home, path: '/' },
            { name: BREADCRUMB_TEXT.dealers, path: '/dealers' },
          ]),
          ...(isIndexableView(view)
            ? [
                itemListSchema(
                  DEALERS_TEXT.listName(place),
                  directory.data.map((dealer) => ({
                    name: dealer.brandName,
                    path: dealerPath(dealer.slug),
                  })),
                  (directory.page.page - 1) * directory.page.limit,
                ),
              ]
            : []),
        ]}
      />
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / Dealers
      </nav>

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px] sm:text-[30px]">
          {place ? `Dealers in ${place}` : 'Verified dealers'}
        </h1>
        <span className="text-[14px] ink-muted tnum">{directory.countLabel}</span>
      </div>

      <p className="mb-[20px] mt-[8px] max-w-[62ch] text-[14px] leading-[1.6] ink-muted">
        Every dealership below is identity- and GST-verified by Dealers-Drive. The cars belong to
        them — enquiries go straight to the yard.
      </p>

      <DirectoryFilters
        cities={directory.cities}
        city={city}
        locations={locations}
        {...(district ? { district } : {})}
        {...(q ? { q } : {})}
      />

      {directory.data.length > 0 ? (
        <div className="grid items-stretch gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {directory.data.map((dealer) => (
            <DirectoryCard key={dealer.slug} dealer={dealer} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No dealerships match that search"
          message={
            q
              ? `Nothing here is called "${q}". Clear the search to see every verified dealership.`
              : 'No verified dealerships have listed cars in this area yet.'
          }
          action={
            <Link href="/dealers" className="btn btn-primary">
              Show all dealers
            </Link>
          }
        />
      )}

      <Pagination page={directory.page} city={cityParam(city)} district={district} q={q} />
    </div>
  );
}

function Pagination({
  page,
  city,
  district,
  q,
}: {
  page: DealerDirectoryResponse['page'];
  city?: string;
  district?: string;
  q?: string;
}) {
  if (page.totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {page.page > 1 ? (
        <Link
          href={`/dealers${qs({ city, district, q, page: page.page - 1 })}`}
          rel="prev"
          className="btn btn-secondary"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[13px] ink-subtle tnum">
        Page {page.page} of {page.totalPages}
      </span>
      {page.page < page.totalPages ? (
        <Link
          href={`/dealers${qs({ city, district, q, page: page.page + 1 })}`}
          rel="next"
          className="btn btn-secondary"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
