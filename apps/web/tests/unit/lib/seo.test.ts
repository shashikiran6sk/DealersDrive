import { describe, expect, it } from 'vitest';

import { hasFilterParams, indexPolicy, seoMetadata } from '../../../src/lib/seo.js';

/**
 * `indexPolicy` always returns the object form; Next's `Robots` type also
 * admits a bare string, which is what makes the property read need narrowing.
 */
function robotsOf(policy: ReturnType<typeof indexPolicy>): { index: boolean; follow: boolean } {
  return policy.robots as { index: boolean; follow: boolean };
}

/**
 * ARCHITECTURE §17.2, the whole indexing policy in one function — and the
 * reason it *is* one function: thirteen facets combine into millions of URLs,
 * and if each route decided its own robots tag the policy would drift silently
 * until Search Console reported a crawl-budget problem months later.
 *
 * The distinction that carries the most weight is `noindex, follow` versus
 * `noindex, nofollow`. A filtered page is thin and must not be indexed, but
 * the links *out* of it are how a crawler reaches deep listing pages — so
 * `follow` stays on. Turning it off would quietly de-index the catalogue.
 */

describe('the indexable landing pages', () => {
  it('indexes the homepage against itself', () => {
    expect(indexPolicy({ kind: 'home' })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/',
    });
  });

  it('indexes an unfiltered /cars', () => {
    expect(indexPolicy({ kind: 'cars', hasFilters: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/cars',
    });
  });

  /**
   * City is the one facet deliberately indexed — "used cars in Vellore" is a
   * real search, and there are tens of cities rather than millions of
   * combinations.
   */
  it('indexes a city page and canonicalises it to itself', () => {
    expect(indexPolicy({ kind: 'cars', city: 'vellore', hasFilters: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/cars?city=vellore',
    });
  });

  it('indexes an unfiltered dealer directory', () => {
    expect(indexPolicy({ kind: 'dealers', hasQuery: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/dealers',
    });
  });

  it('indexes a city-scoped dealer directory', () => {
    expect(indexPolicy({ kind: 'dealers', city: 'vellore', hasQuery: false }).canonical).toBe(
      '/dealers?city=vellore',
    );
  });
});

describe('filtered pages', () => {
  /** Thin, and combinatorially unbounded. */
  it('does not index a filtered /cars', () => {
    expect(indexPolicy({ kind: 'cars', hasFilters: true }).robots).toEqual({
      index: false,
      follow: true,
    });
  });

  /** The crawl path to every deep listing page runs through these links. */
  it('still follows the links out of a filtered page', () => {
    expect(indexPolicy({ kind: 'cars', hasFilters: true }).robots).toMatchObject({ follow: true });
    expect(indexPolicy({ kind: 'dealers', hasQuery: true }).robots).toMatchObject({ follow: true });
  });

  /**
   * The canonical collapses to the clean path, so a crawler that reaches
   * `/cars?fuel=petrol&owners=1&city=vellore` is told the page that matters is
   * `/cars?city=vellore`.
   */
  it('canonicalises a filtered page back to its clean path', () => {
    expect(indexPolicy({ kind: 'cars', city: 'vellore', hasFilters: true }).canonical).toBe(
      '/cars?city=vellore',
    );
    expect(indexPolicy({ kind: 'cars', hasFilters: true }).canonical).toBe('/cars');
  });

  it('does not index a searched dealer directory', () => {
    expect(robotsOf(indexPolicy({ kind: 'dealers', hasQuery: true })).index).toBe(false);
  });
});

describe('pages the API decides on', () => {
  /**
   * A listing sold more than 30 days ago, or a dealership with no live cars,
   * should not be indexed — and only the API knows those facts. Where it has
   * answered, its answer wins.
   */
  it('indexes a live listing', () => {
    expect(
      indexPolicy({ kind: 'resolved', canonical: '/car/swift-vxi', isIndexable: true }),
    ).toEqual({ robots: { index: true, follow: true }, canonical: '/car/swift-vxi' });
  });

  it('does not index one the API called unindexable', () => {
    expect(
      indexPolicy({ kind: 'resolved', canonical: '/car/swift-vxi', isIndexable: false }).robots,
    ).toEqual({ index: false, follow: true });
  });

  it('keeps the canonical the API supplied, whichever way it answered', () => {
    for (const isIndexable of [true, false]) {
      expect(
        indexPolicy({ kind: 'resolved', canonical: '/dealers/sri-lakshmi', isIndexable }).canonical,
      ).toBe('/dealers/sri-lakshmi');
    }
  });
});

describe('private pages', () => {
  /**
   * `nofollow` as well as `noindex`, and this is the one place both are off.
   * A console page links to a dealer's own inventory; following those links
   * would put a crawler on pages that only exist behind a session.
   */
  it('neither indexes nor follows', () => {
    expect(indexPolicy({ kind: 'private' }).robots).toEqual({ index: false, follow: false });
  });

  it('offers no canonical, because there is no public URL to point at', () => {
    expect(indexPolicy({ kind: 'private' }).canonical).toBe('');
  });
});

describe('seoMetadata', () => {
  it('returns a robots fragment ready to spread into generateMetadata', () => {
    expect(seoMetadata({ kind: 'home' })).toEqual({
      robots: { index: true, follow: true },
      alternates: { canonical: '/' },
    });
  });

  /** An empty canonical would render `<link rel="canonical" href="">`. */
  it('omits alternates entirely when there is no canonical', () => {
    expect(seoMetadata({ kind: 'private' })).toEqual({ robots: { index: false, follow: false } });
    expect(seoMetadata({ kind: 'private' })).not.toHaveProperty('alternates');
  });

  it('carries a filtered page’s clean canonical through', () => {
    expect(seoMetadata({ kind: 'cars', city: 'vellore', hasFilters: true })).toEqual({
      robots: { index: false, follow: true },
      alternates: { canonical: '/cars?city=vellore' },
    });
  });
});

describe('hasFilterParams', () => {
  /**
   * These four describe *which* page this is rather than narrowing it, so a
   * page carrying only them is still the canonical landing page. Counting
   * `page=2` as a filter would de-index the whole of pagination.
   */
  it.each(['city', 'page', 'limit', 'sort'])('does not count %s as a filter', (key) => {
    expect(hasFilterParams({ [key]: 'x' })).toBe(false);
  });

  it('counts none of them together as a filter either', () => {
    expect(hasFilterParams({ city: 'vellore', page: '2', limit: '24', sort: 'price_asc' })).toBe(
      false,
    );
  });

  it.each(['make', 'fuel', 'priceMin', 'owners', 'q', 'dealer'])('counts %s as a filter', (key) => {
    expect(hasFilterParams({ [key]: 'x' })).toBe(true);
  });

  it('counts a filter alongside the describing keys', () => {
    expect(hasFilterParams({ city: 'vellore', page: '2', fuel: 'petrol' })).toBe(true);
  });

  it('is false for an empty query', () => {
    expect(hasFilterParams({})).toBe(false);
  });
});
