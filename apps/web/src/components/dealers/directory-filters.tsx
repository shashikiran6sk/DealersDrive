'use client';

import type { DealerDirectoryResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.5 — a 260px name search and a row of city toggle chips.
 *
 * Like every other filter in the product, this writes to the URL rather than to
 * a store, so `/dealers?city=vellore` is shareable, server-renderable and
 * survives a back button (ARCHITECTURE §15.2).
 *
 * The chips are toggles rather than a single-select list: pressing the chip
 * that is already on clears the filter, which is the only affordance there is
 * for going back to every city without reaching for the browser.
 */
export function DirectoryFilters({
  cities,
  city,
  q,
}: {
  cities: DealerDirectoryResponse['cities'];
  city?: string;
  q?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');

  // The input is uncontrolled by the URL between submits, but a navigation —
  // a chip, the back button, a shared link — has to win over what was typed.
  useEffect(() => setQuery(q ?? ''), [q]);

  function go(next: { city?: string; q?: string }) {
    const params = new URLSearchParams();
    if (next.city) params.set('city', next.city);
    if (next.q) params.set('q', next.q);
    const encoded = params.toString();
    router.push(encoded ? `/dealers?${encoded}` : '/dealers');
  }

  return (
    <div className="mb-[22px] flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ ...(city ? { city } : {}), ...(query.trim() ? { q: query.trim() } : {}) });
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
        const selected = entry.slug === city;
        return (
          <button
            key={entry.slug}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              go({
                ...(selected ? {} : { city: entry.slug }),
                ...(query.trim() ? { q: query.trim() } : {}),
              })
            }
            className={cn(
              'tag cursor-pointer px-3 py-[6px] text-[12px]',
              selected
                ? 'bg-(--color-accent) text-white'
                : 'border border-(--color-divider) bg-transparent',
            )}
          >
            {entry.name} <span className="tnum opacity-70">{entry.count}</span>
          </button>
        );
      })}
    </div>
  );
}
