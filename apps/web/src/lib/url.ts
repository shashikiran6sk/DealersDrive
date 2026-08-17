import type { SortOption, VehicleQuery } from '@dealers-drive/contracts';

/**
 * Search state lives in the URL and nowhere else.
 *
 * That is free SEO, free sharing and a free back button, and it is why the
 * filter panel is a client component that writes to the URL rather than a
 * store that the server has to be told about (ARCHITECTURE §15.2).
 *
 * Facet ordering is canonical — city → make → model → year — so the facet
 * landing pages deferred to month 3 are routing work, not a rewrite (§17.1).
 */
export const FACET_ORDER = [
  'city',
  'make',
  'model',
  'variant',
  'q',
  'priceMin',
  'priceMax',
  'yearMin',
  'yearMax',
  'kmMax',
  'fuel',
  'transmission',
  'bodyType',
  'owners',
  'seats',
  'airbagsMin',
  'color',
  'rtoState',
  'rto',
  'dealer',
  'sort',
  'page',
  'limit',
] as const;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** Normalises Next's `searchParams` into the exact string map the API takes. */
export function toApiQuery(params: SearchParamsInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FACET_ORDER) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

export function buildSearchUrl(base: string, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of FACET_ORDER) {
    const value = params[key];
    if (value === undefined || value === '') continue;
    search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `${base}?${encoded}` : base;
}

/** Toggles one value inside a CSV facet, then resets to page 1. */
export function toggleCsv(
  params: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const current = (params[key] ?? '').split(',').filter(Boolean);
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];

  const out = { ...params };
  if (next.length > 0) out[key] = next.join(',');
  else delete out[key];
  delete out.page;
  return out;
}

export function setParam(
  params: Record<string, string>,
  key: string,
  value: string | undefined,
): Record<string, string> {
  const out = { ...params };
  if (value === undefined || value === '') delete out[key];
  else out[key] = value;
  if (key !== 'page') delete out.page;
  return out;
}

export function isChecked(params: Record<string, string>, key: string, value: string): boolean {
  return (params[key] ?? '').split(',').filter(Boolean).includes(value);
}

/**
 * The sort labels the UI shows, mapped to the API's vocabulary
 * (ARCHITECTURE §27 row 26: "Newest first" is `year_desc`).
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'year_desc', label: 'Newest first' },
  { value: 'km_asc', label: 'KM: Low to High' },
];

export type { VehicleQuery };
