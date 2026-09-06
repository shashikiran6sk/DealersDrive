import type { Metadata } from 'next';

/**
 * ARCHITECTURE §17.2 — the whole indexing policy, in one function.
 *
 * "Implement as a single function — given a route and its result count, return
 * `{index, follow, canonical}` — called by every `generateMetadata`. One place,
 * so the policy cannot drift between routes."
 *
 * The rules it encodes, in full:
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
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * **F095** owns this file and lands the table above in full. **F085** brings it
 * into existence with the two cases the dealer directory needs — `dealers` and
 * `resolved` — because a searchable directory that is indexable at every `?q=`
 * permutation is exactly the thin-page problem this policy was written to
 * prevent, and deferring it would mean shipping the harm and fixing it later.
 *
 * The shape is the baseline's, not a sketch of it: F095 adds `home`, `cars` and
 * `private` to the same union and the same switch. `hasFilterParams` and
 * `NON_FILTER_KEYS` arrive with `/cars` (**F077**), which is the only route
 * that has filters to ask about.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type SeoRoute =
  | { kind: 'dealers'; city?: string | undefined; hasQuery: boolean }
  | { kind: 'resolved'; canonical: string; isIndexable: boolean };

export interface SeoPolicy {
  robots: NonNullable<Metadata['robots']>;
  canonical: string;
}

const INDEX: SeoPolicy['robots'] = { index: true, follow: true };
/** Still `follow`: the links out of a filtered page are how deep pages get crawled. */
const NOINDEX_FOLLOW: SeoPolicy['robots'] = { index: false, follow: true };

export function indexPolicy(route: SeoRoute): SeoPolicy {
  switch (route.kind) {
    case 'dealers': {
      // A city is a facet we deliberately index; a name search is not. It is an
      // unbounded surface — one URL per string anybody has ever typed — and
      // every one of them is a near-duplicate of the page above it.
      const canonical = route.city ? `/dealers?city=${route.city}` : '/dealers';
      return { robots: route.hasQuery ? NOINDEX_FOLLOW : INDEX, canonical };
    }

    case 'resolved':
      return {
        robots: route.isIndexable ? INDEX : NOINDEX_FOLLOW,
        canonical: route.canonical,
      };
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
