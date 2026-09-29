'use client';

import type { PublicLocations } from '@dealers-drive/contracts';

import { DistrictPicker, DISTRICT_PICKER_TEXT } from '@/components/layout/district-picker';

const CARET = '▾';

export function LocationSelector({ locations }: { locations: PublicLocations }) {
  return (
    <DistrictPicker locations={locations}>
      {(chosen) => (
        <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
          {chosen?.name ?? DISTRICT_PICKER_TEXT.selectDistrict}{' '}
          <span aria-hidden="true">{CARET}</span>
        </button>
      )}
    </DistrictPicker>
  );
}
