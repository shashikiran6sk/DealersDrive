import type { DealerDirectoryResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DirectoryCard } from '@/components/dealers/dealer-card';
import { DirectoryFilters } from '@/components/dealers/directory-filters';
import { EmptyState } from '@/components/ui/primitives';
import { apiGet, qs } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';
import { one, type SearchParamsInput } from '@/lib/url';

/**
 * `/dealers` — the directory grid, a name search and the city chips.
 *
 * SEO, and a directory changes at the pace of onboarding — so the fetches below
 * cache for 10 minutes. The *route* is dynamic on purpose: a prerendered route
 * would call the API during `next build` and bake that environment's dealers
 * into the image (§20.1).
 */
export const dynamic = 'force-dynamic';

function readParams(params: SearchParamsInput): { city?: string; q?: string; page?: string } {
  return { city: one(params, 'city'), q: one(params, 'q'), page: one(params, 'page') };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const { city, q } = readParams(await searchParams);
  const directory = await apiGet<DealerDirectoryResponse>(`/v1/dealers${qs({ city })}`, {
    revalidate: 600,
  });
  const cityName = directory.cities.find((entry) => entry.slug === city)?.name ?? 'your area';

  return {
    title: `Used car dealers in ${cityName}`,
    description: `Verified independent used-car dealerships in ${cityName}. Identity, GSTIN and address checked before a single car goes live.`,
    // A name search is a thin, unbounded surface; a city page is a real one.
    ...seoMetadata({ kind: 'dealers', city, hasQuery: Boolean(q) }),
  };
}

export default async function DealerDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { city, q, page } = readParams(await searchParams);
  const directory = await apiGet<DealerDirectoryResponse>(`/v1/dealers${qs({ city, q, page })}`, {
    revalidate: 600,
  });

  const cityName = directory.cities.find((entry) => entry.slug === city)?.name;

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / Dealers
      </nav>

      <div className="flex flex-wrap items-baseline gap-3">
        {/*
          The heading names a place only when one was chosen. The baseline said
          "Dealers near Tamil Nadu" on the unfiltered page, which was a
          hard-coded state from the days when the platform had five towns in one
          of them (D6).
        */}
        <h1 className="text-[34px]">{cityName ? `Dealers in ${cityName}` : 'Verified dealers'}</h1>
        <span className="text-[14px] ink-muted tnum">{directory.countLabel}</span>
      </div>

      <p className="mb-[18px] mt-[6px] max-w-[62ch] text-[14px] ink-secondary">
        Every dealership below is identity- and GST-verified by Dealers-Drive. The cars belong to
        them — enquiries go straight to the yard.
      </p>

      <DirectoryFilters
        cities={directory.cities}
        {...(city ? { city } : {})}
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
              : 'No verified dealerships have listed cars in this city yet.'
          }
          action={
            <Link href="/dealers" className="btn btn-primary">
              Show all dealers
            </Link>
          }
        />
      )}

      <Pagination page={directory.page} city={city} q={q} />
    </div>
  );
}

function Pagination({
  page,
  city,
  q,
}: {
  page: DealerDirectoryResponse['page'];
  city?: string;
  q?: string;
}) {
  if (page.totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {page.page > 1 ? (
        <Link
          href={`/dealers${qs({ city, q, page: page.page - 1 })}`}
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
          href={`/dealers${qs({ city, q, page: page.page + 1 })}`}
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
