import { describe, expect, it, vi } from 'vitest';

import { snapshotOf } from '../../../../src/modules/search/search.snapshot.js';
import type { SearchRepository } from '../../../../src/modules/search/search.repository.js';
import { createSearchService } from '../../../../src/modules/search/search.service.js';

describe('snapshotOf', () => {
  it('builds once per fingerprint, and again when the fingerprint moves', async () => {
    let builds = 0;
    const snapshot = snapshotOf(() => Promise.resolve((builds += 1)));

    expect(await snapshot('a')).toBe(1);
    expect(await snapshot('a')).toBe(1);
    expect(await snapshot('b')).toBe(2);
    expect(await snapshot('a')).toBe(3);
  });

  it('shares one build between requests that arrive while it runs', async () => {
    let finish: (value: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const snapshot = snapshotOf(load);

    const first = snapshot('a');
    const second = snapshot('a');
    finish('built');

    expect(await Promise.all([first, second])).toEqual(['built', 'built']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps no failure: the next request builds again', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('database away'))
      .mockResolvedValueOnce('built');
    const snapshot = snapshotOf(load);

    await expect(snapshot('a')).rejects.toThrow('database away');
    expect(await snapshot('a')).toBe('built');
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the sitemap and landing reads', () => {
  function service(fingerprints: string[]) {
    const repo = {
      inventoryFingerprint: vi.fn(() => Promise.resolve(fingerprints.shift() ?? 'last')),
      sitemapListings: vi.fn(() => Promise.resolve([])),
      sitemapDealers: vi.fn(() => Promise.resolve([])),
      landingListings: vi.fn(() => Promise.resolve([])),
      landingDealers: vi.fn(() => Promise.resolve([])),
    };
    return { repo, search: createSearchService({ repo: repo as unknown as SearchRepository }) };
  }

  it('reads the inventory once while nothing has changed', async () => {
    const { repo, search } = service(['v1', 'v1', 'v1', 'v1']);
    await search.sitemap();
    await search.sitemap();
    await search.landingPages();
    await search.landingPages();

    expect(repo.sitemapListings).toHaveBeenCalledTimes(1);
    expect(repo.sitemapDealers).toHaveBeenCalledTimes(1);
    expect(repo.landingListings).toHaveBeenCalledTimes(1);
    expect(repo.landingDealers).toHaveBeenCalledTimes(1);
    expect(repo.inventoryFingerprint).toHaveBeenCalledTimes(4);
  });

  it('reads it again as soon as anything has', async () => {
    const { repo, search } = service(['v1', 'v2', 'v2', 'v3']);
    await search.sitemap();
    await search.sitemap();
    await search.landingPages();
    await search.landingPages();

    expect(repo.sitemapListings).toHaveBeenCalledTimes(2);
    expect(repo.landingListings).toHaveBeenCalledTimes(2);
  });
});
