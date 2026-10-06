import { unstable_cache } from 'next/cache';

export interface CachedLookupOptions {
  revalidate: number;
  tags: string[];
}

export function cachedLookup<T>(
  keyParts: string[],
  load: () => Promise<T | null>,
  options: CachedLookupOptions,
): Promise<T | null> {
  return unstable_cache(load, keyParts, options)();
}
