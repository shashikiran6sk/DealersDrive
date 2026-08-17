'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Blueprint } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.2 — the blueprint search block: a 48px field, a 48px primary
 * CTA and a 12px line naming the city. Enter on the field runs the search
 * (§2.3), which is why this island is a client component at all.
 */
export function HeroSearch({ cityName, citySlug }: { cityName: string; citySlug?: string }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  function run() {
    const params = new URLSearchParams();
    if (citySlug) params.set('city', citySlug);
    if (query.trim()) params.set('q', query.trim());
    const encoded = params.toString();
    router.push(encoded ? `/cars?${encoded}` : '/cars');
  }

  return (
    <Blueprint className="mt-[26px] bg-(--color-bg) p-[14px]">
      <form
        className="flex flex-wrap gap-[10px]"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <label className="sr-only" htmlFor="hero-search">
          Search make, model or variant
        </label>
        <input
          id="hero-search"
          className="input h-12 min-w-[220px] flex-1 text-[16px]"
          placeholder="Search make, model or variant — e.g. Swift VXi"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn btn-primary h-12 px-[26px] text-[15px]">
          Search cars
        </button>
      </form>
      <div className="mt-[9px] text-[12px] ink-subtle">
        Showing cars in {cityName} · change the city from the header
      </div>
    </Blueprint>
  );
}
