'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

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
 * ## Keyboard (R19)
 *
 * Enter or Space opens, **the arrows move between districts**, Home and End
 * jump to the ends, Enter or Space chooses, Esc closes and returns focus to the
 * trigger, an outside click closes it. Tab closes it too, because a menu left
 * open behind a moved focus is a menu that eats the next click.
 *
 * The arrows are the part that was missing, and they were missing quietly: the
 * baseline's docblock promised "arrows move" and the baseline implemented Esc
 * and an outside click, exactly as this did. A `role="listbox"` announces to a
 * screen reader that the arrows work, so the absence was a promise made twice
 * over — in a comment and in a role — and kept in neither.
 *
 * Focus roves rather than being tracked with `aria-activedescendant`: the
 * options are real `<button>`s, and moving real focus is what makes Enter,
 * Space and the global `:focus-visible` ring work without re-implementing any
 * of them.
 *
 * One of the three elements in the product that carries a shadow.
 */
export function LocationSelector({ locations }: { locations: PublicLocations }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const name = locations.districts.find((row) => row.slug === active)?.name ?? 'All districts';

  /**
   * The menu, as one list.
   *
   * "All districts" is an option like any other — it carries its own count, and
   * making it the first element rather than a special case above the loop is
   * what lets the arrow keys treat the whole menu as one thing.
   */
  const options: { slug: string | null; name: string; count: number }[] = [
    { slug: null, name: 'All districts', count: locations.total },
    ...locations.districts,
  ];

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.slug === active),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  /**
   * Where the arrows are, which is not always where the URL is: it starts on
   * the chosen district and then moves under the keys without choosing
   * anything, because a listbox that navigated on arrow-down would fire a
   * router push per keystroke.
   */
  const [focused, setFocused] = useState(activeIndex);

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

  // Opening puts focus in the menu, on the district the URL already names.
  // Without this the arrows would have nothing to move from, and a screen
  // reader would announce a listbox that focus had never entered.
  useEffect(() => {
    if (open) optionRefs.current[focused]?.focus();
  }, [open, focused]);

  /** Arrow keys move focus; they do not choose. Esc is handled document-wide. */
  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const last = options.length - 1;
    const moves: Record<string, number | undefined> = {
      ArrowDown: Math.min(focused + 1, last),
      ArrowUp: Math.max(focused - 1, 0),
      Home: 0,
      End: last,
    };

    const next = moves[event.key];
    if (next !== undefined) {
      // Down at the bottom of a menu must not scroll the page behind it.
      event.preventDefault();
      setFocused(next);
      return;
    }

    // A menu left open behind a moved focus is a menu that eats the next click.
    if (event.key === 'Tab') setOpen(false);
  }

  function toggle(): void {
    // Reopening starts from the URL again rather than from wherever the arrows
    // were left last time, which is the same place the button's label comes
    // from — so what is highlighted is what the button says.
    if (!open) setFocused(activeIndex);
    setOpen((value) => !value);
  }

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
    // Focus was inside the menu, and the menu is about to stop existing (R19).
    // Without this it falls to the body and the next Tab starts from the top of
    // the document — the same trap Esc already avoided.
    triggerRef.current?.focus();
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
        onClick={toggle}
      >
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        {name} <span aria-hidden="true">▾</span>
      </button>

      {open ? (
        /*
          The legacy panel (**R19**): 220px, and no height cap. It was 240px
          with `max-h-[60vh] overflow-y-auto`, which is a scrolling menu — the
          shape this product uses nowhere else, and one the baseline's version
          of this dropdown never had.

          The trade is real and worth knowing: past roughly fifteen districts
          the menu is taller than a short viewport and the last rows go under
          the fold. Tamil Nadu has 38, so this is a decision to revisit when
          the platform is in more than a handful of them — one line, back the
          way it came.
        */
        <div
          id={menuId}
          role="listbox"
          aria-label="Looking for dealers in"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[220px] border border-(--color-divider) bg-white p-[6px] shadow-[var(--shadow-lg)]"
        >
          <div className="px-[9px] py-[6px] text-[10px] uppercase tracking-[0.1em] ink-subtle">
            Looking for dealers in
          </div>

          {options.map((option, index) => (
            <button
              /* `null` is "All districts", which is a real option carrying its
                 own count rather than an escape hatch with a blank beside it. */
              key={option.slug ?? 'all'}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={option.slug === active}
              /* What `.dd-nav-item[aria-current]` colours — the row the URL
                 already names. It has been on this element since R11 with no
                 rule to act on it. */
              aria-current={option.slug === active ? 'true' : undefined}
              /* Focus roves: one option is reachable by Tab, the arrows move
                 which one that is. */
              tabIndex={index === focused ? 0 : -1}
              className="dd-nav-item flex items-center gap-2"
              onClick={() => {
                select(option.slug);
              }}
            >
              <span className="flex-1">{option.name}</span>
              <span className="text-[11px] opacity-60 tnum">{option.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
