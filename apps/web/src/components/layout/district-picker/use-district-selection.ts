'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { LOCATION_CHILD_PARAMS } from './district-picker.constants';
import type { DistrictUnit } from './district-picker.types';
import { scopedPathOf, unitOf } from './utils';

export function useDistrictSelection(locations: PublicLocations): {
  chosen: DistrictChip | null;
  unit: DistrictUnit;
  select: (slug: string | null) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const chosen = locations.districts.find((row) => row.slug === active) ?? null;
  const target = scopedPathOf(pathname);

  function select(slug: string | null): void {
    const next = new URLSearchParams(target === pathname ? searchParams.toString() : '');
    if (slug === null) next.delete('district');
    else next.set('district', slug);
    for (const key of LOCATION_CHILD_PARAMS) next.delete(key);

    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
  }

  return { chosen, unit: unitOf(pathname), select };
}
