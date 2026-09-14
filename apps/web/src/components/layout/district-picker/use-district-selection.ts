'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DIRECTORY_PATH } from './district-picker.constants';

/**
 * Reading the district out of the URL, and writing a new one back — the one rule
 * about what selecting a district *means*, in one place, because R23 gave it a
 * second caller. Exported so a future opener inherits the rule rather than
 * restating it.
 *
 * **Choosing a district drops the towns.** `?district=ranipet&city=katpadi` is an
 * empty page: Katpadi is in Vellore. The page number goes with them.
 */
export function useDistrictSelection(locations: PublicLocations): {
  chosen: DistrictChip | null;
  select: (slug: string | null) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const chosen = locations.districts.find((row) => row.slug === active) ?? null;

  function select(slug: string | null): void {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === null) next.delete('district');
    else next.set('district', slug);
    // The towns belonged to the district being left, and the page number to a
    // result set that no longer exists.
    next.delete('city');
    next.delete('page');

    /*
     * A district filters dealerships, so it goes to the directory — from
     * anywhere that is not already showing one. Choosing a place from the home
     * page is a person saying where they are, and the useful answer to that is
     * the dealerships there, not the same home page with a query string on it.
     */
    const target = pathname.startsWith(DIRECTORY_PATH) ? pathname : DIRECTORY_PATH;
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
  }

  return { chosen, select };
}
