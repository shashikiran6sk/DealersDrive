import * as nextCache from 'next/cache';
import { describe, expect, it, vi } from 'vitest';

import { cachedLookup } from '@/lib/cached-lookup';

/**
 * BUG-NEW-010 residual. Next's fetch cache stores a response only when it is a
 * 200, so once the API stopped serving a car or a dealership the background
 * refresh was thrown away and the warmed page was served indefinitely — unless
 * a web action revalidated its tag. The public detail lookups now go through
 * `unstable_cache`, which stores what the loader returns, a "gone" `null`
 * included, so the next refresh after the window replaces the stale page.
 */
describe('cachedLookup', () => {
  it('caches the loader under the given key, window and tags', async () => {
    const spy = vi.spyOn(nextCache, 'unstable_cache');
    const load = vi.fn().mockResolvedValue({ slug: 'a-car' });

    const result = await cachedLookup(['public-vehicle', 'a-car'], load, {
      revalidate: 60,
      tags: ['vehicles', 'vehicle:a-car'],
    });

    expect(result).toEqual({ slug: 'a-car' });
    expect(spy).toHaveBeenCalledWith(load, ['public-vehicle', 'a-car'], {
      revalidate: 60,
      tags: ['vehicles', 'vehicle:a-car'],
    });
  });

  it('hands back a missing resource as null, which is a value the cache can hold', async () => {
    const result = await cachedLookup(['public-dealer', 'gone'], () => Promise.resolve(null), {
      revalidate: 600,
      tags: ['dealer:gone', 'dealers'],
    });

    expect(result).toBeNull();
  });
});
