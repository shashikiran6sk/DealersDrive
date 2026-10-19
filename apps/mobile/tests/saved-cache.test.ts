import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import type { SavedVehiclesResponse } from '@dealers-drive/contracts/saved';
import {
  patchSavedMembership,
  removeSavedFromPages,
  restoreSavedRows,
} from '../src/features/saved/saved-cache';
import { discoveryCar } from './discovery-fixtures';
it('rolls back only the failed car, preserving concurrent saved actions and other owners', () => {
  const cache = new QueryClient();
  const key = ['customer', 'one', 'saved-list'];
  const entry = (slug: string) => ({
    savedAt: '2026-10-16T00:00:00Z',
    vehicle: { ...discoveryCar, slug },
  });
  const first = entry('first');
  const second = entry('second');
  const data: InfiniteData<SavedVehiclesResponse> = {
    pages: [{ data: [first, second], page: { hasMore: false, nextCursor: null } }],
    pageParams: [''],
  };
  cache.setQueryData(key, data);
  cache.setQueryData(['customer', 'one', 'saved-slugs'], ['first', 'second']);
  cache.setQueryData(['customer', 'two', 'saved-slugs'], ['private']);
  const removed = removeSavedFromPages(cache, 'one', 'first');
  removeSavedFromPages(cache, 'one', 'second');
  patchSavedMembership(cache, 'one', 'first', false);
  patchSavedMembership(cache, 'one', 'second', false);
  patchSavedMembership(cache, 'one', 'third', true);
  restoreSavedRows(cache, removed);
  patchSavedMembership(cache, 'one', 'first', true);
  expect(cache.getQueryData<InfiniteData<SavedVehiclesResponse>>(key)?.pages[0]?.data).toEqual([
    first,
  ]);
  expect(cache.getQueryData(['customer', 'one', 'saved-slugs'])).toEqual(['third', 'first']);
  expect(cache.getQueryData(['customer', 'two', 'saved-slugs'])).toEqual(['private']);
  cache.removeQueries({ queryKey: key });
  restoreSavedRows(cache, removed);
  expect(cache.getQueryData(key)).toBeUndefined();
  cache.clear();
});
it('never pretends an unhydrated projection is a complete saved list', () => {
  const cache = new QueryClient();
  patchSavedMembership(cache, 'one', 'first', true);
  expect(cache.getQueryData(['customer', 'one', 'saved-slugs'])).toBeUndefined();
  cache.clear();
});
