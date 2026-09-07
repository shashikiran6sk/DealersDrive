'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * DESIGN-SPEC §2.18 — the header's location button, left of the dealer doors.
 *
 * ## Districts, not cities
 *
 * The baseline's version of this listed cities, off a five-row `cities` table
 * that **D6** removed. Districts is the better question at this level and would
 * have been even with the table: a district is the area somebody would drive
 * across, the towns inside it give no hint they are related — Arakkonam and
 * Walajapet share a district with Arcot and with nothing else — and a header
 * dropdown listing every town on the platform stops being readable at about
 * thirty. The towns are the chips on the directory, narrowed to whatever is
 * chosen here.
 *
 * ## Choosing a district drops the towns
 *
 * `?district=ranipet&city=katpadi` is an empty page: Katpadi is in Vellore.
 * Rather than let a buyer navigate into that and wonder what they did, changing
 * the district clears `city` — the chips underneath are about to be a different
 * set of towns anyway.
 *
 * Keyboard: Enter/Space opens, Esc closes and returns focus to the trigger, an
 * outside click closes it. One of the three elements in the product that
 * carries a shadow.
 */
export function LocationSelector({ locations }: { locations: PublicLocations }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const name = locations.districts.find((row) => row.slug === active)?.name ?? 'All districts';

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function select(slug: string | null): void {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === null) next.delete('district');
    else next.set('district', slug);
    // The towns belonged to the district being left, and the page number to a
    // result set that no longer exists.
    next.delete('city');
    next.delete('page');

    /*
     * A district filters dealerships, so it goes to the directory — from
     * anywhere that is not already showing one. Choosing a place from the home
     * page is a person saying where they are, and the useful answer to that is
     * the dealerships there, not the same home page with a query string on it.
     */
    const target = pathname.startsWith('/dealers') ? pathname : '/dealers';
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary flex items-center gap-[7px]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        {name} <span aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Looking for dealers in"
          className="absolute right-0 top-[calc(100%+6px)] z-40 max-h-[60vh] w-[240px] overflow-y-auto border border-(--color-divider) bg-white p-[6px] shadow-[var(--shadow-lg)]"
        >
          <div className="px-[9px] py-[6px] text-[10px] uppercase tracking-[0.1em] ink-subtle">
            Looking for dealers in
          </div>

          {/* The way back to everything, and it carries its own count so the
              row is a fact rather than an escape hatch. */}
          <button
            type="button"
            role="option"
            aria-selected={active === null}
            className="dd-nav-item flex items-center gap-2"
            onClick={() => select(null)}
          >
            <span className="flex-1">All districts</span>
            <span className="text-[11px] opacity-60 tnum">{locations.total}</span>
          </button>

          {locations.districts.map((district) => (
            <button
              key={district.slug}
              type="button"
              role="option"
              aria-selected={district.slug === active}
              aria-current={district.slug === active ? 'true' : undefined}
              className="dd-nav-item flex items-center gap-2"
              onClick={() => select(district.slug)}
            >
              <span className="flex-1">{district.name}</span>
              <span className="text-[11px] opacity-60 tnum">{district.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
