import type {
  CitiesResponse,
  DealerDirectoryResponse,
  VehicleListResponse,
} from '@dealers-drive/contracts';
import type { MetadataRoute } from 'next';

import { apiGet } from '@/lib/api';
import { serverConfig } from '@/lib/config';

/**
 * ARCHITECTURE §17.4 — only indexable URLs, with an **accurate** `lastmod`
 * (lying gets a sitemap deprioritised). Regenerated hourly.
 *
 * Built per request from data the fetch cache holds for an hour, rather than
 * prerendered at build time: `next build` must not call the API, or the image
 * would carry one environment's URLs into every other one (§20.1).
 *
 * Sharding at 50k per child is deferred until there is a second shard's worth
 * of inventory; at that point this becomes `sitemap.ts` + `sitemap/[id].ts` and
 * the URL-building below moves across unchanged.
 */
export const dynamic = 'force-dynamic';

/** Well inside Google's 50k limit and inside the API's page ceiling. */
const PAGE_SIZE = 48;
const MAX_PAGES = 40;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { webBaseUrl } = serverConfig();

  const [cities, dealers] = await Promise.all([
    apiGet<CitiesResponse>('/v1/cities', { revalidate: 3600 }),
    apiGet<DealerDirectoryResponse>(`/v1/dealers?limit=${PAGE_SIZE}`, { revalidate: 3600 }),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${webBaseUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${webBaseUrl}/cars`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${webBaseUrl}/dealers`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  // City landing pages are the one facet §17.2 marks indexable. A12 leads with
  // an "all of Tamil Nadu" pseudo-city for the header selector; that is the
  // unfiltered `/cars` page, already listed above.
  for (const city of cities.data) {
    if (city.count === 0 || city.state === undefined) continue;
    entries.push({
      url: `${webBaseUrl}/cars?city=${city.slug}`,
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }

  for (const dealer of dealers.data) {
    // A dealer with nothing live is not indexable (§17.2), so it is not listed.
    if (dealer.carCount === 0) continue;
    entries.push({
      url: `${webBaseUrl}/dealers/${dealer.slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  // Vehicles, walked page by page. Every row here is APPROVED and belongs to an
  // ACTIVE dealer — that is what A2 returns, and it is the same visibility rule
  // the rest of the product uses (Rule 6).
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const results = await apiGet<VehicleListResponse>(
      `/v1/vehicles?page=${page}&limit=${PAGE_SIZE}&sort=year_desc`,
      { revalidate: 3600 },
    );

    for (const vehicle of results.data) {
      // No `lastModified`. §17.4 demands an *accurate* one and warns that
      // lying deprioritises the whole sitemap — and no public response carries
      // a listing's approved-at or updated-at timestamp (A2's `VehicleCard`
      // has none). Omitting the field is honest; inventing `new Date()` would
      // claim every car changed on every crawl.
      entries.push({
        url: `${webBaseUrl}/car/${vehicle.slug}`,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }

    if (page >= results.page.totalPages) break;
  }

  return entries;
}
