import { afterEach, describe, expect, it, vi } from 'vitest';

import { directoryView, indexPolicy, isIndexableView, seoMetadata } from '@/lib/seo';

import { production } from './env';

/**
 * The faceted-navigation policy. `/cars` has a dozen filters, a sort, a search
 * box and paging, and every combination is a URL; almost none of them is a page
 * worth sending anybody to from a search engine. Two are: the directory itself
 * and each district, and each of their later pages so the cars on them can be
 * reached. Everything else is `noindex, follow`, canonical to the nearest one.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('directoryView', () => {
  it('reads the district and the page, and calls anything else a narrowing', () => {
    expect(directoryView({}, false)).toEqual({
      district: undefined,
      page: 1,
      narrowed: false,
      empty: false,
    });
    expect(directoryView({ district: 'vellore', page: '3' }, false)).toEqual({
      district: 'vellore',
      page: 3,
      narrowed: false,
      empty: false,
    });
    expect(directoryView({ district: 'vellore', fuel: 'diesel' }, false).narrowed).toBe(true);
    expect(directoryView({ sort: 'price-asc' }, false).narrowed).toBe(true);
    expect(directoryView({ q: 'creta' }, false).narrowed).toBe(true);
  });

  it('does not count an empty value or an empty list as a narrowing', () => {
    expect(directoryView({ city: [], q: undefined, brand: '' }, false).narrowed).toBe(false);
    expect(directoryView({ city: ['katpadi'] }, false).narrowed).toBe(true);
  });

  it('reads a nonsense page as the first', () => {
    expect(directoryView({ page: 'abc' }, false).page).toBe(1);
    expect(directoryView({ page: '-2' }, false).page).toBe(1);
  });
});

describe('indexPolicy for /cars', () => {
  it('indexes the directory, a district and a later page, each at its own URL', () => {
    expect(indexPolicy({ kind: 'cars', narrowed: false, empty: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/cars',
    });
    expect(
      indexPolicy({ kind: 'cars', district: 'vellore', page: 1, narrowed: false, empty: false }),
    ).toEqual({ robots: { index: true, follow: true }, canonical: '/cars?district=vellore' });
    expect(indexPolicy({ kind: 'cars', page: 4, narrowed: false, empty: false }).canonical).toBe(
      '/cars?page=4',
    );
  });

  it('keeps a filtered, sorted or searched view out, canonical to its landing page', () => {
    const view = directoryView({ district: 'vellore', fuel: 'diesel', page: '2' }, false);

    expect(indexPolicy({ kind: 'cars', ...view })).toEqual({
      robots: { index: false, follow: true },
      canonical: '/cars?district=vellore',
    });
  });

  it('keeps a view with nothing on it out, rather than answering it with a 404', () => {
    const view = directoryView({ district: 'nowhere' }, true);
    expect(isIndexableView(view)).toBe(false);
    expect(indexPolicy({ kind: 'cars', ...view }).robots).toEqual({ index: false, follow: true });
  });
});

describe('seoMetadata', () => {
  it('marks a sign-in page noindex but lets its links be followed', () => {
    production();
    expect(seoMetadata({ kind: 'noindex' })).toEqual({ robots: { index: false, follow: true } });
  });

  it('marks a console page noindex and nofollow, with no canonical', () => {
    production();
    expect(seoMetadata({ kind: 'private' })).toEqual({ robots: { index: false, follow: false } });
  });

  it('never restricts the snippet of a page that may be indexed', () => {
    production();
    const { robots } = seoMetadata({ kind: 'resolved', canonical: '/', isIndexable: true });

    expect(robots).toEqual({ index: true, follow: true, 'max-image-preview': 'large' });
    expect(JSON.stringify(robots)).not.toMatch(/nosnippet|max-snippet|noimageindex/);
  });

  it('turns every page noindex outside production', () => {
    vi.stubEnv('APP_ENV', 'dev');
    expect(seoMetadata({ kind: 'resolved', canonical: '/', isIndexable: true }).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});
