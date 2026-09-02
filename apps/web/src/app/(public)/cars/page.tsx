import type { CitiesResponse, FacetsResponse, VehicleListResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet, SearchToolbar } from '@/components/search/search-toolbar';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';
import { apiGet } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { hasFilterParams, seoMetadata } from '@/lib/seo';
import { buildSearchUrl, toApiQuery, type SearchParamsInput } from '@/lib/url';

/**
 * Filters live in the URL, so every state renders (§15.1). Rendered per
 * request; the *data* is cached for 60s by the fetches below.
 *
 * Not `revalidate`: that prerenders the unfiltered page at build time, which
 * calls the API and bakes one environment's inventory into the image. See the
 * note on the home page — build-once / promote-many (§20.1) requires that this
 * image contain no environment's data.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const params = await searchParams;
  const cities = await apiGet<CitiesResponse>('/v1/cities', { revalidate: 60 });
  const city = typeof params.city === 'string' ? params.city : undefined;
  const cityName = cities.data.find((entry) => entry.slug === city)?.name ?? 'Tamil Nadu';

  return {
    // Bare: the root template appends the brand (`%s · Dealers-Drive`).
    title: `Used cars in ${cityName}`,
    description: `Browse verified used cars in ${cityName} from independent dealers. Every listing is reviewed before it goes live.`,
    // Robots and canonical come from the one policy resolver (§17.2).
    ...seoMetadata({ kind: 'cars', city, hasFilters: hasFilterParams(toApiQuery(params)) }),
  };
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const raw = await searchParams;
  const params = toApiQuery(raw);
  const query = new URLSearchParams(params).toString();

  const [results, facets, cities] = await Promise.all([
    apiGet<VehicleListResponse>(`/v1/vehicles${query ? `?${query}` : ''}`, { revalidate: 60 }),
    apiGet<FacetsResponse>(`/v1/vehicles/facets${query ? `?${query}` : ''}`, { revalidate: 60 }),
    apiGet<CitiesResponse>('/v1/cities', { revalidate: 60 }),
  ]);

  const cityName = cities.data.find((entry) => entry.slug === params.city)?.name ?? 'Tamil Nadu';

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
      <ItemListJsonLd results={results} />

      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/cars">Used cars</Link> / {cityName}
      </nav>

      <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
        <h1 className="text-[34px]">Used cars in {cityName}</h1>
        <span className="text-[14px] ink-muted tnum">{results.resultLabel}</span>
        <SearchToolbar params={params} basePath="/cars" />
        <MobileFilterSheet
          facets={facets}
          params={params}
          basePath="/cars"
          resultCount={results.page.total}
        />
      </div>

      {results.appliedFilters.length > 0 ? (
        <div className="mb-[18px] flex flex-wrap items-center gap-[7px]">
          {results.appliedFilters.map((chip) => (
            <Link
              key={`${chip.key}:${chip.value}`}
              href={chip.removeHref}
              className="tag tag-outline text-[11px]"
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">✕</span>
            </Link>
          ))}
          <Link href={results.clearAllHref} className="btn btn-ghost text-[12px]">
            Clear all
          </Link>
        </div>
      ) : null}

      <div className="grid gap-[22px] lg:[grid-template-columns:250px_1fr]">
        <aside className="sticky top-[84px] hidden self-start lg:block">
          <FilterPanel facets={facets} params={params} basePath="/cars" />
        </aside>

        <div className="min-w-0">
          <Suspense fallback={<ResultsSkeleton />}>
            {results.data.length > 0 ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
                {results.data.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No cars match these filters"
                message={`Widen your budget or clear a filter to see more of the cars available in ${cityName}.`}
                action={
                  <Link href={results.clearAllHref} className="btn btn-primary">
                    Clear all filters
                  </Link>
                }
              />
            )}
          </Suspense>

          <Pagination results={results} params={params} />
        </div>
      </div>
    </div>
  );
}

function Pagination({
  results,
  params,
}: {
  results: VehicleListResponse;
  params: Record<string, string>;
}) {
  if (results.page.totalPages <= 1) return null;

  const page = results.page.page;
  const prev = buildSearchUrl('/cars', { ...params, page: String(page - 1) });
  const next = buildSearchUrl('/cars', { ...params, page: String(page + 1) });

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {page > 1 ? (
        <Link href={prev} rel="prev" className="btn btn-secondary">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[13px] ink-subtle tnum">
        Page {page} of {results.page.totalPages}
      </span>
      {page < results.page.totalPages ? (
        <Link href={next} rel="next" className="btn btn-secondary">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Skeletons match the real card dimensions exactly (§2.20). */
function ResultsSkeleton() {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
      {Array.from({ length: 6 }, (_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}

function ItemListJsonLd({ results }: { results: VehicleListResponse }) {
  const { webBaseUrl } = serverConfig();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: results.page.total,
    itemListElement: results.data.map((vehicle, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${webBaseUrl}/car/${vehicle.slug}`,
      name: `${vehicle.year} ${vehicle.title}`,
    })),
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
