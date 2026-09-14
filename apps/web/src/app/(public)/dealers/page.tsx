import type { DealerDirectoryResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DirectoryCard } from '@/components/dealers/dealer-card';
import { DirectoryFilters } from '@/components/dealers/directory-filters';
import { EmptyState } from '@/components/ui/primitives';
import { apiGet, qs } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';
import { getPublicLocations } from '@/lib/locations';
import { seoMetadata } from '@/lib/seo';
import { many, one, type SearchParamsInput } from '@/lib/url';

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const { city, district, q } = readParams(await searchParams);
  const directory = await apiGet<DealerDirectoryResponse>(
    `/v1/dealers${qs({ city: cityParam(city), district })}`,
    { revalidate: 600, tags: [DEALERS_TAG] },
  );

  const place = placeName(directory, city, district) ?? 'your area';

  return {
    title: `Used car dealers in ${place}`,
    description: `Verified independent used-car dealerships in ${place}. Identity, GSTIN and address checked before a single car goes live.`,
    ...seoMetadata({
      kind: 'dealers',
      ...(district ? { city: district } : city.length === 1 ? { city: city[0] } : {}),
      hasQuery: Boolean(q) || city.length > 1,
    }),
  };
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
  const { city, district, q, page } = readParams(await searchParams);
  const [directory, locations] = await Promise.all([
    apiGet<DealerDirectoryResponse>(
      `/v1/dealers${qs({ city: cityParam(city), district, q, page })}`,
      { revalidate: 600, tags: [DEALERS_TAG] },
    ),
    getPublicLocations(),
  ]);

  const place = placeName(directory, city, district);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / Dealers
      </nav>

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[34px]">{place ? `Dealers in ${place}` : 'Verified dealers'}</h1>
        <span className="text-[14px] ink-muted tnum">{directory.countLabel}</span>
      </div>

      <p className="mb-[18px] mt-[6px] max-w-[62ch] text-[14px] ink-secondary">
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
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
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
