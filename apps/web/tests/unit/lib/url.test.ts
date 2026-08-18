import { describe, expect, it } from 'vitest';

import {
  buildSearchUrl,
  FACET_ORDER,
  isChecked,
  setParam,
  SORT_OPTIONS,
  toApiQuery,
  toggleCsv,
} from '../../../src/lib/url.js';

/**
 * §15.2: **search state lives in the URL and nowhere else.** That is what
 * makes the back button, sharing and SEO work without any of them being
 * features anyone had to build — and it is why the filter panel writes to the
 * URL rather than to a store the server would have to be told about.
 *
 * The canonical facet order is the other half. Two URLs describing the same
 * search must be byte-identical, or a crawler indexes both and the cache
 * stores both. Ordering by `FACET_ORDER` rather than by insertion is what
 * guarantees that.
 *
 * Every mutation also resets to page 1, because a filtered result set is
 * shorter than the one the user was paging through — landing on an empty
 * page 7 after ticking a box reads as a broken site.
 */

describe('FACET_ORDER', () => {
  /** §17.1: the facet landing pages deferred to month 3 are routing work, not a rewrite. */
  it('starts with the facets the SEO plan indexes first', () => {
    expect(FACET_ORDER.slice(0, 4)).toEqual(['city', 'make', 'model', 'variant']);
  });

  it('lists no facet twice', () => {
    expect(new Set(FACET_ORDER).size).toBe(FACET_ORDER.length);
  });

  it('ends with the pagination keys, which describe the page rather than filter it', () => {
    expect(FACET_ORDER.slice(-3)).toEqual(['sort', 'page', 'limit']);
  });
});

describe('toApiQuery', () => {
  it('normalises a plain search-params object', () => {
    expect(toApiQuery({ city: 'vellore', fuel: 'petrol' })).toEqual({
      city: 'vellore',
      fuel: 'petrol',
    });
  });

  /** Next hands a repeated key through as an array; the API takes one CSV string. */
  it('takes the first value when a key was repeated', () => {
    expect(toApiQuery({ city: ['vellore', 'chennai'] })).toEqual({ city: 'vellore' });
  });

  it('drops an empty value rather than sending an empty filter', () => {
    expect(toApiQuery({ city: '', q: undefined, fuel: 'petrol' })).toEqual({ fuel: 'petrol' });
  });

  /**
   * §9.2 makes an unknown parameter a 400, so passing one through would turn a
   * stray link into a broken page rather than a slightly wrong one.
   */
  it('drops a key the API does not know', () => {
    expect(toApiQuery({ city: 'vellore', utm_source: 'newsletter' })).toEqual({ city: 'vellore' });
  });

  it('drops an empty array', () => {
    expect(toApiQuery({ city: [] })).toEqual({});
  });

  it('is empty for empty input', () => {
    expect(toApiQuery({})).toEqual({});
  });

  it('emits the keys in canonical order regardless of input order', () => {
    const out = toApiQuery({ sort: 'price_asc', make: 'kia', city: 'vellore' });

    expect(Object.keys(out)).toEqual(['city', 'make', 'sort']);
  });
});

describe('buildSearchUrl', () => {
  it('returns the bare path when there is nothing to filter by', () => {
    expect(buildSearchUrl('/cars', {})).toBe('/cars');
  });

  it('appends a query string when there is', () => {
    expect(buildSearchUrl('/cars', { city: 'vellore' })).toBe('/cars?city=vellore');
  });

  /**
   * The property that keeps one search at one URL: two objects describing the
   * same filters produce the same string, whatever order they were built in.
   */
  it('orders the parameters canonically, so the same search is the same URL', () => {
    const a = buildSearchUrl('/cars', { sort: 'price_asc', city: 'vellore', make: 'kia' });
    const b = buildSearchUrl('/cars', { make: 'kia', sort: 'price_asc', city: 'vellore' });

    expect(a).toBe(b);
    expect(a).toBe('/cars?city=vellore&make=kia&sort=price_asc');
  });

  it('drops an empty value rather than emitting a dangling key', () => {
    expect(buildSearchUrl('/cars', { city: 'vellore', q: '' })).toBe('/cars?city=vellore');
  });

  it('percent-encodes a value that needs it', () => {
    expect(buildSearchUrl('/cars', { q: 'swift vxi' })).toBe('/cars?q=swift+vxi');
    expect(buildSearchUrl('/cars', { q: 'a&b' })).toContain('a%26b');
  });

  it('ignores a key outside the facet list', () => {
    expect(buildSearchUrl('/cars', { city: 'vellore', nope: 'x' })).toBe('/cars?city=vellore');
  });

  it('works for any base path', () => {
    expect(buildSearchUrl('/dealers/sri-lakshmi-motors', { page: '2' })).toBe(
      '/dealers/sri-lakshmi-motors?page=2',
    );
  });
});

describe('toggleCsv', () => {
  it('adds a value that was not selected', () => {
    expect(toggleCsv({}, 'fuel', 'petrol')).toEqual({ fuel: 'petrol' });
  });

  it('appends to an existing selection', () => {
    expect(toggleCsv({ fuel: 'petrol' }, 'fuel', 'diesel')).toEqual({ fuel: 'petrol,diesel' });
  });

  it('removes a value that was selected', () => {
    expect(toggleCsv({ fuel: 'petrol,diesel' }, 'fuel', 'petrol')).toEqual({ fuel: 'diesel' });
  });

  /** An empty `fuel=` in the URL is noise that also breaks the canonical form. */
  it('deletes the key entirely when the last value comes off', () => {
    expect(toggleCsv({ fuel: 'petrol' }, 'fuel', 'petrol')).toEqual({});
  });

  /**
   * Ticking a box shortens the result set, so staying on page 7 would land the
   * user on an empty page — which reads as a broken site rather than a filter.
   */
  it('resets to page one', () => {
    expect(toggleCsv({ fuel: 'petrol', page: '7' }, 'fuel', 'diesel')).not.toHaveProperty('page');
  });

  it('leaves the other facets alone', () => {
    expect(toggleCsv({ city: 'vellore', fuel: 'petrol' }, 'fuel', 'diesel')).toMatchObject({
      city: 'vellore',
    });
  });

  it('does not mutate the object it was given', () => {
    const params = { fuel: 'petrol', page: '3' };

    toggleCsv(params, 'fuel', 'diesel');

    expect(params).toEqual({ fuel: 'petrol', page: '3' });
  });

  it('is its own inverse', () => {
    const once = toggleCsv({ fuel: 'petrol' }, 'fuel', 'diesel');

    expect(toggleCsv(once, 'fuel', 'diesel')).toEqual({ fuel: 'petrol' });
  });

  it('ignores the empty entries a stray comma leaves', () => {
    expect(toggleCsv({ fuel: 'petrol,,' }, 'fuel', 'diesel')).toEqual({ fuel: 'petrol,diesel' });
  });
});

describe('setParam', () => {
  it('sets a value', () => {
    expect(setParam({}, 'sort', 'price_asc')).toEqual({ sort: 'price_asc' });
  });

  it('replaces an existing one', () => {
    expect(setParam({ sort: 'newest' }, 'sort', 'price_asc')).toEqual({ sort: 'price_asc' });
  });

  it('clears the key when given undefined or an empty string', () => {
    expect(setParam({ sort: 'newest' }, 'sort', undefined)).toEqual({});
    expect(setParam({ sort: 'newest' }, 'sort', '')).toEqual({});
  });

  it('resets to page one when any other facet changes', () => {
    expect(setParam({ page: '5' }, 'sort', 'price_asc')).not.toHaveProperty('page');
  });

  /** Paging is the one change that must *not* reset paging. */
  it('keeps the page when the page itself is what changed', () => {
    expect(setParam({ city: 'vellore', page: '1' }, 'page', '3')).toEqual({
      city: 'vellore',
      page: '3',
    });
  });

  it('does not mutate its input', () => {
    const params = { sort: 'newest', page: '2' };

    setParam(params, 'sort', 'price_asc');

    expect(params).toEqual({ sort: 'newest', page: '2' });
  });
});

describe('isChecked', () => {
  it('is true for a value in the list', () => {
    expect(isChecked({ fuel: 'petrol,diesel' }, 'fuel', 'diesel')).toBe(true);
  });

  it('is false for one that is not', () => {
    expect(isChecked({ fuel: 'petrol' }, 'fuel', 'diesel')).toBe(false);
  });

  it('is false when the facet is absent entirely', () => {
    expect(isChecked({}, 'fuel', 'petrol')).toBe(false);
  });

  /** `petrol` must not match inside `petrol-hybrid`, or a checkbox lies. */
  it('matches whole values, not substrings', () => {
    expect(isChecked({ fuel: 'petrol-hybrid' }, 'fuel', 'petrol')).toBe(false);
  });

  it('is false for an empty facet value', () => {
    expect(isChecked({ fuel: '' }, 'fuel', 'petrol')).toBe(false);
  });
});

describe('SORT_OPTIONS', () => {
  it('leads with the default ordering', () => {
    expect(SORT_OPTIONS[0]).toEqual({ value: 'relevance', label: 'Recommended' });
  });

  /**
   * §27 row 26: the label the product uses is "Newest first" and the API's
   * value for it is `year_desc` — newest *car*, not newest listing. Mapping it
   * to `newest` would sort by approval date and quietly show old cars first.
   */
  it('maps "Newest first" to year_desc, not to newest', () => {
    const option = SORT_OPTIONS.find((entry) => entry.label === 'Newest first');

    expect(option?.value).toBe('year_desc');
  });

  it('offers a distinct label for every option', () => {
    const labels = SORT_OPTIONS.map((option) => option.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('offers a distinct value for every option', () => {
    const values = SORT_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
  });

  it('writes every label in sentence case rather than shouting', () => {
    for (const { label } of SORT_OPTIONS) {
      expect(label).not.toBe(label.toUpperCase());
      expect(label).not.toContain('_');
    }
  });
});
