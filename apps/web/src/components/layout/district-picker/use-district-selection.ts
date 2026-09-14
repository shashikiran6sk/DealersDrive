'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DIRECTORY_PATH } from './district-picker.constants';

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
    next.delete('city');
    next.delete('page');

    const target = pathname.startsWith(DIRECTORY_PATH) ? pathname : DIRECTORY_PATH;
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
  }

  return { chosen, select };
}
