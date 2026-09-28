'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import { useState } from 'react';

import { LocationDialog } from '@/components/layout/district-picker';

import { HERO_SEARCH_TEXT } from './hero-search.constants';

export interface HeroDistrictProps {
  id: string;
  locations: PublicLocations;
  value: string;
  onChange: (slug: string) => void;
}

export function HeroDistrict({ id, locations, value, onChange }: HeroDistrictProps) {
  const [open, setOpen] = useState(false);
  const chosen = locations.districts.find((district) => district.slug === value) ?? null;

  return (
    <div className="field m-0">
      <label htmlFor={id}>{HERO_SEARCH_TEXT.district}</label>
      <input type="hidden" name="district" value={value} />
      <LocationDialog
        open={open}
        onOpenChange={setOpen}
        locations={locations}
        chosen={chosen}
        unit="car"
        onSelect={(slug) => {
          onChange(slug ?? '');
          setOpen(false);
        }}
        trigger={
          <button
            id={id}
            type="button"
            className="input flex h-[48px] items-center justify-between gap-[8px] text-left"
          >
            <span className={chosen ? 'truncate' : 'truncate ink-subtle'}>
              {chosen ? chosen.name : HERO_SEARCH_TEXT.selectDistrict}
            </span>
            <span aria-hidden="true" className="ink-subtle">
              ▾
            </span>
          </button>
        }
      />
    </div>
  );
}
