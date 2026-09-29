'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import { useSearchParams } from 'next/navigation';

import { DistrictPicker } from '@/components/layout/district-picker';

import { DISTRICT_SCOPE_TEXT } from './district-scope.constants';

export interface DistrictScopeProps {
  locations: PublicLocations;
}

export function DistrictScope({ locations }: DistrictScopeProps) {
  const active = useSearchParams().get('district');
  const chosen = locations.districts.find((row) => row.slug === active) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DistrictPicker locations={locations}>
        {(picked) => (
          <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
            {picked ? DISTRICT_SCOPE_TEXT.change : DISTRICT_SCOPE_TEXT.selectDistrict}
          </button>
        )}
      </DistrictPicker>
      <span className="text-[12px] ink-subtle">
        {chosen
          ? DISTRICT_SCOPE_TEXT.label(DISTRICT_SCOPE_TEXT.place(chosen.name, chosen.state))
          : DISTRICT_SCOPE_TEXT.everyDistrictHint}
      </span>
    </div>
  );
}
