'use client';

import type { DealerDirectoryResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.5 — a 260px name search and a row of city toggle chips.
 *
 * Like every other filter in the product, this writes to the URL rather than to
 * a store, so `/dealers?district=vellore&city=katpadi,vellore` is shareable,
 * server-renderable and survives a back button (ARCHITECTURE §15.2).
 *
 * ## The chips are multi-select
 *
 * They were one-at-a-time, and pressing the active chip cleared it. That is the
 * right shape for a filter whose values are exclusive, and these are not: a
 * buyer working the Vellore belt is looking at Katpadi *and* Vellore, twenty
 * minutes apart, and single-select made them run the same search twice and hold
 * the two result sets in their head.
 *
 * So a chip toggles itself in and out of a set. `aria-pressed` already said
 * "toggle" — this makes the behaviour match the announcement.
 *
 * ## The row is the district's towns, not the platform's
 *
 * `cities` arrives narrowed to whichever district the header selected, which is
 * what keeps the row readable as the platform grows past one belt. Selecting a
 * district is the header's job (`LocationSelector`); this component only reads
 * the result of it.
 */
export function DirectoryFilters({
  cities,
  city,
  district,
  q,
}: {
  cities: DealerDirectoryResponse['cities'];
  /** The slugs currently toggled on. */
  city?: string[];
  district?: string;
  q?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');

  // The input is uncontrolled by the URL between submits, but a navigation —
  // a chip, the back button, a shared link — has to win over what was typed.
  useEffect(() => setQuery(q ?? ''), [q]);

  const selected = new Set(city ?? []);

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

      {cities.map((entry) => {
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
    </div>
  );
}
