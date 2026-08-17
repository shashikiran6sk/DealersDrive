import type { Metadata } from 'next';

/**
 * ARCHITECTURE §17.2 — the whole indexing policy, in one function.
 *
 * "Implement as a single function — given a route and its result count, return
 * `{index, follow, canonical}` — called by every `generateMetadata`. One place,
 * so the policy cannot drift between routes."
 *
 * The rules it encodes:
 *
 * | Route                                | Policy                          |
 * |--------------------------------------|---------------------------------|
 * | `/`, `/cars`, `/dealers`             | index, follow · self canonical  |
 * | `/cars?page=2..40`                   | index, follow · self canonical  |
 * | any URL with filter query params     | noindex, follow · clean path    |
 * | `/car/{slug}` live                   | index · self                    |
 * | `/car/{slug}` sold > 30 days         | noindex, follow (API decides)   |
 * | `/dealers/{slug}` active + ≥1 live   | index · self (API decides)      |
 * | `/saved`, `/enquiry-sent`            | noindex                         |
 * | `/dealer/*`, `/admin/*`, `/api/*`    | noindex + robots.txt disallow   |
 *
 * Where the API already resolved indexability (`seo.isIndexable` on A5 and A9),
 * that answer wins: it knows the sold-30-days and live-listing-count facts this
 * layer does not.
 */
export type SeoRoute =
  | { kind: 'home' }
  | { kind: 'cars'; city?: string | undefined; hasFilters: boolean }
  | { kind: 'dealers'; city?: string | undefined; hasQuery: boolean }
  | { kind: 'resolved'; canonical: string; isIndexable: boolean }
  | { kind: 'private' };

export interface SeoPolicy {
  robots: NonNullable<Metadata['robots']>;
  canonical: string;
}

const INDEX: SeoPolicy['robots'] = { index: true, follow: true };
/** Still `follow`: the links out of a filtered page are how deep pages get crawled. */
const NOINDEX_FOLLOW: SeoPolicy['robots'] = { index: false, follow: true };
const NOINDEX: SeoPolicy['robots'] = { index: false, follow: false };

export function indexPolicy(route: SeoRoute): SeoPolicy {
  switch (route.kind) {
    case 'home':
      return { robots: INDEX, canonical: '/' };

    case 'cars': {
      // A city is a facet we deliberately index; everything else collapses to
      // the clean path, so 13 facets cannot become millions of thin pages.
      const canonical = route.city ? `/cars?city=${route.city}` : '/cars';
      return { robots: route.hasFilters ? NOINDEX_FOLLOW : INDEX, canonical };
    }

    case 'dealers': {
      const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers';
      return { robots: route.hasQuery ? NOINDEX_FOLLOW : INDEX, canonical };
    }

    case 'resolved':
      return {
        robots: route.isIndexable ? INDEX : NOINDEX_FOLLOW,
        canonical: route.canonical,
      };

    case 'private':
      return { robots: NOINDEX, canonical: '' };
  }
}

/** The `Metadata` fragment, ready to spread into a `generateMetadata` return. */
export function seoMetadata(route: SeoRoute): Pick<Metadata, 'robots' | 'alternates'> {
  const policy = indexPolicy(route);
  return {
    robots: policy.robots,
    ...(policy.canonical ? { alternates: { canonical: policy.canonical } } : {}),
  };
}

/** Query keys that describe the page rather than filtering it. */
const NON_FILTER_KEYS = new Set(['city', 'page', 'limit', 'sort']);

export function hasFilterParams(query: Record<string, string>): boolean {
  return Object.keys(query).some((key) => !NON_FILTER_KEYS.has(key));
}
