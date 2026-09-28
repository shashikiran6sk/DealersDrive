import type { PublicAvailability } from '@dealers-drive/contracts';

import { countLabel } from '@/lib/plural';

export const SAVED_LIST_TEXT = {
  title: 'Saved cars',
  count: (n: number) => countLabel(n, 'car'),
  intro: 'Cars you have saved, on any device you sign in on.',
  emptyTitle: 'No saved cars yet',
  emptyMessage: 'Tap the heart on any car to keep it here while you compare.',
  browse: 'Browse cars',
  browseHref: '/cars',
  more: 'Show more',
  savedOn: (date: string) => `Saved ${date}`,
} as const;

export interface SavedGroup {
  key: string;
  title: string;
  note: string | null;
  includes: readonly PublicAvailability[];
}

export const SAVED_GROUPS: readonly SavedGroup[] = [
  { key: 'available', title: 'Available', note: null, includes: ['AVAILABLE'] },
  {
    key: 'reserved',
    title: 'Reserved',
    note: 'Reserved for another buyer. If the sale does not go ahead, it will be back on sale.',
    includes: ['RESERVED'],
  },
  {
    key: 'unavailable',
    title: 'No longer available',
    note: 'Sold or taken off the marketplace. Remove them whenever you like.',
    includes: ['SOLD', 'UNAVAILABLE'],
  },
];

export const SAVED_PAGE_LIMIT = 50;

export function savedHref(cursor?: string): string {
  return cursor ? `/saved?cursor=${encodeURIComponent(cursor)}` : '/saved';
}
