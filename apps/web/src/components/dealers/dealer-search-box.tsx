'use client';

import type { DealerSuggestion, DealerSuggestResponse } from '@dealers-drive/contracts';
import { useMemo } from 'react';

import {
  AutocompletePanel,
  HighlightedText,
  useAutocomplete,
  type AutocompleteSource,
} from '@/components/ui/autocomplete';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.5 and the Search-Bar UI reference — the directory's search
 * box, with recommendations (**R43**).
 *
 * ## What it replaces
 *
 * A plain 260px input inside a `<form>`, which submitted the raw typed text as
 * `?q=` and offered nothing on the way. That input is gone: it asked a buyer to
 * spell a dealership's trading name correctly with no help and no feedback, and
 * on a platform where a yard may be registered as "Sri Lakshmi Motors" or "Sree
 * Lakshmi Motors" that is a coin toss between the grid and an empty state.
 *
 * **The grid's `?q=` filter is unchanged** — this is a better way to arrive at
 * a search term, not a different kind of search. Choosing a recommendation
 * navigates to `/dealers?q=<that dealership's exact trading name>`, which is a
 * URL that was always valid, is shareable, server-renders, and survives the
 * back button like every other filter in the product (ARCHITECTURE §15.2).
 *
 * ## Why it does not navigate to the dealership
 *
 * Jumping straight to `/dealers/<slug>` was the alternative, and it is the
 * wrong one *here*: this box sits above a grid the buyer is looking at, and a
 * control that replaces the page they are reading with a different page is a
 * link pretending to be a filter. The card in the grid is the way to the
 * portfolio, and it already is one.
 *
 * ## The interaction is not in this file
 *
 * Debounce, abort, the stale-answer guard, the arrow keys and the ARIA live in
 * `components/ui/autocomplete.tsx`, which knows nothing about dealerships. This
 * file is the source, the row, and what selecting one means — which is all that
 * a `VehicleSearchBox` at **F077** should have to write.
 */
export function DealerSearchBox({
  q,
  district,
  city,
  districtName,
  onSearch,
  className,
}: {
  /** The search currently applied to the grid — the box opens holding it. */
  q?: string;
  /** The page's own filters, passed through so suggestions match the grid. */
  district?: string;
  city?: string[];
  /** "Vellore", for the dropdown's heading. Absent on the unfiltered page. */
  districtName?: string;
  /** Apply a search term, or clear it. `DirectoryFilters` owns the URL. */
  onSearch: (term: string | null) => void;
  className?: string;
}) {
  const cityParam = city && city.length > 0 ? [...city].sort().join(',') : undefined;

  /*
   * Rebuilt only when the filters move. `useAutocomplete` holds it in a ref so
   * an unstable reference would not refetch, but a memo keeps the fetch closure
   * honest about which district it is asking within.
   */
  const source = useMemo<AutocompleteSource<DealerSuggestion>>(
    () => ({
      async suggest(search, signal) {
        const params = new URLSearchParams({ search });
        if (district) params.set('district', district);
        if (cityParam) params.set('city', cityParam);

        const response = await fetch(`/api/search/dealers?${params.toString()}`, {
          signal,
          headers: { Accept: 'application/json' },
        });

        // Any non-2xx is a failed suggestion, and the panel says so. There is
        // nothing per-status for a buyer to do differently: a 429 and a 502
        // both mean "not right now", and the grid behind is unaffected either
        // way because it was rendered from a different call.
        if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`);

        return (await response.json()) as DealerSuggestResponse;
      },
      keyOf: (item) => item.slug,
      // What lands in the input, and — via `onSearch` — what filters the grid:
      // the dealership's exact trading name, which is what `?q=` matches on.
      valueOf: (item) => item.brandName,
    }),
    [district, cityParam],
  );

  const autocomplete = useAutocomplete<DealerSuggestion>({
    source,
    initialValue: q ?? '',
    onSelect: (item) => onSearch(item.brandName),
    onClear: () => onSearch(null),
  });

  return (
    <AutocompletePanel
      autocomplete={autocomplete}
      className={cn('w-full max-w-[360px]', className)}
      label="Search dealership name"
      placeholder={
        districtName ? `Search dealerships in ${districtName}…` : 'Search dealership name'
      }
      groupLabel={districtName ? `Dealerships in ${districtName} district` : 'Dealerships'}
      emptyMessage={(search) =>
        search ? `No dealership matches “${search}”.` : 'No dealerships match that search.'
      }
    >
      {({ items, highlighted, search, optionProps }) =>
        items.map((item, index) => (
          <li
            key={item.slug}
            {...optionProps(item, index)}
            className={cn(
              'flex cursor-pointer select-none items-center justify-between gap-[10px] border-b border-(--color-divider) px-[12px] py-[8px] last:border-b-0',
              index === highlighted &&
                'border-l-[3px] border-l-(--color-accent) bg-(--color-accent-100) pl-[9px]',
            )}
          >
            <span className="flex min-w-0 items-center gap-[10px]">
              <span
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bg-(--color-accent-200) text-[11px] font-bold text-(--color-accent-800) font-heading"
                aria-hidden="true"
              >
                {item.initials}
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span
                  className={cn(
                    'truncate text-[13.5px]',
                    index === highlighted && 'font-semibold text-(--color-accent-800)',
                  )}
                >
                  {/*
                    Marked only when the name is *why* this row is here. A
                    dealership offered because its town matched has none of the
                    typed characters in its name, and underlining nothing is the
                    honest rendering of that — see `DealerSuggestion.matchedOn`.
                  */}
                  {item.matchedOn === 'brandName' ? (
                    <HighlightedText text={item.brandName} match={search} />
                  ) : (
                    item.brandName
                  )}
                </span>
                <span className="truncate text-[11px] ink-subtle tnum">
                  {item.matchedOn === 'brandName' ? (
                    item.metaLabel
                  ) : (
                    // The place is what matched, so the place is what is marked.
                    <HighlightedText text={item.metaLabel} match={search} />
                  )}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-[8px]">
              <span className="tag tag-ok text-[10.5px]">✓ Verified</span>
              {/*
                The one affordance that says Enter will take this row, shown on
                the row Enter would actually take. It is the whole explanation
                of the default highlight, and it costs a line.

                Hidden rather than absent on the other rows, which is what the
                UI reference does and is not a detail: rendering it only on the
                highlighted row takes ~70px away from that row alone, so the
                meta line truncates on whichever row the buyer is on and the
                whole list appears to reflow under the arrow keys.
              */}
              <span
                aria-hidden={index !== highlighted}
                className={cn(
                  'hidden text-[10px] ink-subtle font-mono sm:inline',
                  index !== highlighted && 'invisible',
                )}
              >
                Select ↵
              </span>
            </span>
          </li>
        ))
      }
    </AutocompletePanel>
  );
}
