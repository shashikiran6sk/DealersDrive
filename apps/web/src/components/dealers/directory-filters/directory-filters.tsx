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
  /** The slugs currently toggled on. */
  city?: string[];
  district?: string;
  q?: string;
  /** Every district on the platform — what the picker offers. */
  locations: PublicLocations;
}

/**
 * DESIGN-SPEC §3.5 — a 260px name search, and the row that narrows the grid.
 * Like every other filter in the product this writes to the URL rather than to
 * a store, so the result is shareable, server-renderable and survives a back
 * button (ARCHITECTURE §15.2).
 *
 * ## The row has two shapes (R23)
 *
 * **Within a district** it is the towns in it, as toggle chips. **With no
 * district chosen** it is a `Select district` button plus only the towns
 * *already* applied — the full row rendered every town on the platform, which is
 * forty-four chips five rows deep at 120 dealerships and gets monotonically
 * worse with every signup.
 *
 * An applied town always shows, district or not: `indexPolicy` names
 * `/dealers?city=vellore` as an indexable canonical, so hiding the row there
 * would apply a filter the buyer can neither see nor clear. The grid underneath
 * is unchanged either way — no district still means every dealership.
 *
 * A button rather than a default district because the districts arrive
 * busiest-first with ties broken alphabetically, so `districts[0]` is not "the
 * busiest" but the earliest-named — and a visitor in Wayanad would be told, in
 * the page's own H1, that they were looking at Bengaluru Urban. Not a modal on
 * arrival either: an interstitial over the one indexed dealers URL, with the
 * document inert behind it, leaves a visitor who cannot find their district with
 * no way forward at all.
 */
export function DirectoryFilters({ cities, city, district, q, locations }: DirectoryFiltersProps) {
  const router = useRouter();
  const selected = new Set(city ?? []);

  /*
   * The district's *name*, for the dropdown's heading and placeholder. Read off
   * the list the picker already has rather than added as a prop: a second copy
   * of that pairing is the thing D6 removed a table to avoid.
   */
  const districtName = locations.districts.find((entry) => entry.slug === district)?.name;

  /*
   * Every town in the district, or — with no district to bound them — only the
   * ones already applied. Never the platform's whole list.
   */
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
      {/*
        Keyed on the applied search so that a navigation — a chip, the back
        button, a shared link — resets what is in it: the box owns what is typed
        between searches, and the URL owns what has been searched for (**R43**).
      */}
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

      {/*
        The way out of a multi-select: with several chips on, un-pressing each in
        turn is not discoverable. It follows the selection and not the district,
        so a buyer who arrived on `/dealers?city=vellore` from a search result
        has the same way out as one who toggled the chip themselves.
      */}
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
          {/*
            What the button is for, and only where there is room for it to be
            read — once a town is applied the chips beside it say what is going
            on and this would be a third thing competing to.
          */}
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
