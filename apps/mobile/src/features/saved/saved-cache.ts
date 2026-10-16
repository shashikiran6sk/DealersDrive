import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { SavedVehicle, SavedVehiclesResponse } from '@dealers-drive/contracts/saved';

export const savedSlugsKey = (owner: string) => ['customer', owner, 'saved-slugs'] as const;
export function patchSavedMembership(cache: QueryClient, owner: string, slug: string, saved: boolean) {
  cache.setQueryData<string[]>(savedSlugsKey(owner), previous => {
    if (!previous) return previous;
    const next = new Set(previous);
    if (saved) next.add(slug); else next.delete(slug);
    return [...next];
  });
}
export interface SavedRemoval { key: QueryKey; rows: { page: number; index: number; entry: SavedVehicle }[] }
export function removeSavedFromPages(cache: QueryClient, owner: string, slug: string): SavedRemoval[] {
  return cache.getQueriesData<InfiniteData<SavedVehiclesResponse>>({ queryKey: ['customer', owner, 'saved-list'] }).flatMap(([key, data]) => {
    if (!data) return [];
    const rows: SavedRemoval['rows'] = [];
    data.pages.forEach((page, pageIndex) => page.data.forEach((entry, index) => { if (entry.vehicle.slug === slug) rows.push({ page: pageIndex, index, entry }); }));
    if (!rows.length) return [];
    cache.setQueryData(key, { ...data, pages: data.pages.map(page => ({ ...page, data: page.data.filter(entry => entry.vehicle.slug !== slug) })) });
    return [{ key, rows }];
  });
}
export function restoreSavedRows(cache: QueryClient, removed: SavedRemoval[]) {
  for (const snapshot of removed) cache.setQueryData<InfiniteData<SavedVehiclesResponse>>(snapshot.key, current => {
    if (!current) return current;
    return { ...current, pages: current.pages.map((page, pageIndex) => {
      const data = [...page.data];
      for (const row of snapshot.rows.filter(row => row.page === pageIndex)) if (!data.some(entry => entry.vehicle.slug === row.entry.vehicle.slug)) data.splice(Math.min(row.index, data.length), 0, row.entry);
      return { ...page, data };
    }) };
  });
}
