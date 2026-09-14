'use client';

import type { DealerDirectoryResponse, PublicLocations } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';

import { DealerSearchBox } from '@/components/dealers/dealer-search-box';
import { DistrictPicker } from '@/components/layout/district-picker';
import { cn } from '@/lib/cn';

import { DIRECTORY_FILTERS_TEXT } from './directory-filters.constants';
import { directoryHref, type DirectoryQuery } from './utils';

export interface DirectoryFiltersProps {
  cities: DealerDirectoryResponse['cities'];
  city?: string[];
  district?: string;
  q?: string;
  locations: PublicLocations;
}

export function DirectoryFilters({ cities, city, district, q, locations }: DirectoryFiltersProps) {
  const router = useRouter();
  const selected = new Set(city ?? []);

  const districtName = locations.districts.find((entry) => entry.slug === district)?.name;

  const visible = district ? cities : cities.filter((entry) => selected.has(entry.slug));

  function go(next: Omit<DirectoryQuery, 'district'>) {
    router.push(directoryHref({ ...next, ...(district ? { district } : {}) }));
  }

  function toggle(slug: string) {
    const next = new Set(selected);
    if (!next.delete(slug)) next.add(slug);
    go({ city: [...next], ...(q ? { q } : {}) });
  }

  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-2">
      <DealerSearchBox
        key={q ?? ''}
        {...(q ? { q } : {})}
        {...(district ? { district } : {})}
        city={[...selected]}
        {...(districtName ? { districtName } : {})}
        onSearch={(term) => {
          go({ city: [...selected], ...(term ? { q: term } : {}) });
        }}
      />

      {visible.map((entry) => {
        const on = selected.has(entry.slug);
        return (
          <button
            key={entry.slug}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(entry.slug)}
            className={cn(
              'tag cursor-pointer px-3 py-[6px] text-[12px]',
              on
                ? 'bg-(--color-accent) text-white'
                : 'border border-(--color-divider) bg-transparent',
            )}
          >
            {entry.name} <span className="tnum opacity-70">{entry.count}</span>
          </button>
        );
      })}

      {selected.size > 0 ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px]"
          onClick={() => go({ city: [], ...(q ? { q } : {}) })}
        >
          {DIRECTORY_FILTERS_TEXT.clearTowns(selected.size)}
        </button>
      ) : null}

      {district ? null : (
        <>
          <DistrictPicker locations={locations}>
            {() => (
              <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
                <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
                {DIRECTORY_FILTERS_TEXT.selectDistrict}
              </button>
            )}
          </DistrictPicker>
          {selected.size === 0 ? (
            <span className="text-[12px] ink-subtle">
              {DIRECTORY_FILTERS_TEXT.everyDistrictHint}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
