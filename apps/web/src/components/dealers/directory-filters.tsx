'use client';

import type { DealerDirectoryResponse, PublicLocations } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';

import { DealerSearchBox } from '@/components/dealers/dealer-search-box';
import { DistrictPicker } from '@/components/layout/district-picker';
import { cn } from '@/lib/cn';

export function DirectoryFilters({
  cities,
  city,
  district,
  q,
  locations,
}: {
  cities: DealerDirectoryResponse['cities'];
  city?: string[];
  district?: string;
  q?: string;
  locations: PublicLocations;
}) {
  const router = useRouter();
  const selected = new Set(city ?? []);

  const districtName = locations.districts.find((entry) => entry.slug === district)?.name;

  const visible = district ? cities : cities.filter((entry) => selected.has(entry.slug));

  function go(next: { city: string[]; q?: string }) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (next.city.length > 0) params.set('city', [...next.city].sort().join(','));
    if (next.q) params.set('q', next.q);
    const encoded = params.toString();
    router.push(encoded ? `/dealers?${encoded}` : '/dealers');
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
          Clear {selected.size === 1 ? 'town' : `${String(selected.size)} towns`}
        </button>
      ) : null}

      {district ? null : (
        <>
          <DistrictPicker locations={locations}>
            {() => (
              <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
                <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
                Select district
              </button>
            )}
          </DistrictPicker>
          {selected.size === 0 ? (
            <span className="text-[12px] ink-subtle">
              Showing every district — pick one to filter by town.
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
