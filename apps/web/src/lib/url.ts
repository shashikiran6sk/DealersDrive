/**
 * Search state lives in the URL and nowhere else.
 *
 * That is free SEO, free sharing and a free back button, and it is why every
 * filter in the product is a client component that writes to the URL rather
 * than a store the server has to be told about (ARCHITECTURE §15.2).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline's version of this file is mostly `FACET_ORDER` — the canonical
 * ordering of the thirteen vehicle facets — plus `toApiQuery` and
 * `buildSearchUrl`, which walk it. All three belong to `/cars` (**F077**) and
 * arrive with it. The dealer directory has two parameters and a page number, so
 * what it needs from here is the type.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

/** Next hands a repeated parameter as an array. The API takes one value. */
export function one(params: SearchParamsInput, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '' ? undefined : value;
}

/**
 * A comma-separated parameter, as the list it stands for.
 *
 * `?city=vellore,katpadi` rather than `?city=vellore&city=katpadi`: the API
 * takes one value per key, the shorter form survives being pasted into a chat
 * window intact, and a single slug still reads as a list of one — so every
 * link shared before the chips became toggles keeps working.
 */
export function many(params: SearchParamsInput, key: string): string[] {
  return (one(params, key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
