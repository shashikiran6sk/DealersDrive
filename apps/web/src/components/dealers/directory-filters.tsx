'use client';

import type { DealerDirectoryResponse, PublicLocations } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DistrictPicker } from '@/components/layout/district-picker';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.5 — a 260px name search, and the row that narrows the grid.
 *
 * Like every other filter in the product, this writes to the URL rather than to
 * a store, so `/dealers?district=vellore&city=katpadi,vellore` is shareable,
 * server-renderable and survives a back button (ARCHITECTURE §15.2).
 *
 * ## The row has two shapes now (R23)
 *
 * **Within a district**, it is the towns in it, as toggle chips — unchanged.
 *
 * **With no district chosen**, it is a `Select district` button, and only the
 * towns that are *already* applied. The chips used to render in full here too,
 * and what they rendered was *every town on the platform*: forty-four of them
 * at 120 dealerships, five wrapped rows deep, before any of them had been
 * narrowed by anything. That is not a filter a buyer reads, it is a wall they
 * scroll past, and it gets monotonically worse with every dealership that signs
 * up — which is the wrong direction for the one control that makes the
 * directory usable.
 *
 * ## An applied town is always visible, district or not
 *
 * `?city=` without `?district=` is not a hypothetical: `indexPolicy` names
 * `/dealers?city=vellore` as an indexable canonical, so it is a URL Google is
 * invited to send people to. Hiding the whole row on that page would apply a
 * filter the buyer can neither see nor clear — a worse fault than the wall,
 * because at least the wall was honest about what it was doing.
 *
 * So the rule is not "chips inside a district". It is: **every applied town
 * shows, and the unapplied ones show once a district makes them a readable
 * set.** The `Clear towns` escape follows the selection rather than the
 * district, for the same reason.
 *
 * The grid underneath is unchanged either way: **no district still means every
 * dealership**. This replaces the row that filters them, not the results. A
 * buyer who wants the whole platform gets the whole platform, and `/dealers`
 * stays the page `indexPolicy` marks indexable.
 *
 * ## Why a button and not a default district
 *
 * Picking one for the visitor was the alternative, and it was considered and
 * rejected: the districts arrive busiest-first, ties broken alphabetically, so
 * on a flat distribution `districts[0]` is not "the busiest district" but the
 * one whose name starts earliest — and a visitor in Wayanad would be told, in
 * the page's own H1, that they were looking at dealers in Bengaluru Urban. An
 * invitation that is ignored costs a click. A wrong guess stated as fact costs
 * trust, and the buyer has no way to know it was a guess.
 *
 * The button is also not a modal on arrival. Auto-opening the dialog would put
 * an interstitial over the one dealers URL the SEO policy indexes, and `Dialog`
 * makes the document inert and locks scroll behind it — so a district a visitor
 * cannot find in the list would leave them with no way forward at all.
 *
 * ## The row is the district's towns, not the platform's
 *
 * `cities` arrives narrowed to whichever district was chosen, which is what
 * keeps the chips readable as the platform grows past one belt. Selecting a
 * district is `DistrictPicker`'s job; this component opens it and reads the
 * result, and never writes `?district=` itself.
 */
export function DirectoryFilters({
  cities,
  city,
  district,
  q,
  locations,
}: {
  cities: DealerDirectoryResponse['cities'];
  /** The slugs currently toggled on. */
  city?: string[];
  district?: string;
  q?: string;
  /** Every district on the platform — what the picker offers. */
  locations: PublicLocations;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');

  // The input is uncontrolled by the URL between submits, but a navigation —
  // a chip, the back button, a shared link — has to win over what was typed.
  useEffect(() => setQuery(q ?? ''), [q]);

  const selected = new Set(city ?? []);

  /*
   * Every town in the district, or — with no district to bound them — only the
   * ones already applied. Never the platform's whole list: that is the row this
   * revision exists to remove.
   */
  const visible = district ? cities : cities.filter((entry) => selected.has(entry.slug));

  function go(next: { city: string[]; q?: string }) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    // Sorted, so that picking the same two towns in either order produces the
    // same URL — one cache entry and one link, rather than two of each.
    if (next.city.length > 0) params.set('city', [...next.city].sort().join(','));
    if (next.q) params.set('q', next.q);
    const encoded = params.toString();
    router.push(encoded ? `/dealers?${encoded}` : '/dealers');
  }

  function toggle(slug: string) {
    const next = new Set(selected);
    if (!next.delete(slug)) next.add(slug);
    go({ city: [...next], ...(query.trim() ? { q: query.trim() } : {}) });
  }

  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ city: [...selected], ...(query.trim() ? { q: query.trim() } : {}) });
        }}
      >
        <label className="sr-only" htmlFor="dealer-search">
          Search dealership name
        </label>
        <input
          id="dealer-search"
          className="input max-w-[260px]"
          placeholder="Search dealership name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>

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
        The way out of a multi-select. With one chip at a time, pressing the
        active one cleared the filter and that was discoverable enough; with
        several on, un-pressing each of them in turn is not.

        It follows the selection and not the district, so a buyer who arrived on
        `/dealers?city=vellore` from a search result has the same way out as one
        who toggled the chip themselves.
      */}
      {selected.size > 0 ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px]"
          onClick={() => go({ city: [], ...(query.trim() ? { q: query.trim() } : {}) })}
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
          {/*
            What the button is *for*, in one line, and only where there is room
            for it to be read — once a town is applied the chips beside it say
            what is going on and this would be a third thing competing to.
          */}
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
