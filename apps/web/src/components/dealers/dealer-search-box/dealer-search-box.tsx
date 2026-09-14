'use client';

import type { DealerSuggestion, DealerSuggestResponse } from '@dealers-drive/contracts';
import { useMemo } from 'react';

import {
  AutocompletePanel,
  useAutocomplete,
  type AutocompleteSource,
} from '@/components/ui/autocomplete';
import { cn } from '@/lib/cn';
import { readJson } from '@/lib/fetch-json';

import { DEALER_SEARCH_TEXT, DEALER_SUGGEST_PATH } from './dealer-search-box.constants';
import type { DealerSearchBoxProps } from './dealer-search-box.types';
import { DealerSuggestionRow } from './dealer-suggestion-row';

/**
 * DESIGN-SPEC §3.5 — the directory's search box, with recommendations (**R43**).
 *
 * It replaces a plain 260px input that submitted the raw typed text as `?q=` and
 * offered nothing on the way: on a platform where a yard may be registered as
 * "Sri Lakshmi Motors" or "Sree Lakshmi Motors", spelling it unaided is a coin
 * toss between the grid and an empty state.
 *
 * **The grid's `?q=` filter is unchanged** — this is a better way to arrive at a
 * search term, not a different kind of search. It does not navigate to the
 * dealership: this box sits above a grid the buyer is reading, and a control
 * that replaces that page is a link pretending to be a filter. The card in the
 * grid is the way to the portfolio.
 *
 * The interaction — debounce, abort, the stale guard, the keys, the ARIA — is
 * `components/ui/autocomplete`, which knows nothing about dealerships. This file
 * is the source, the row, and what selecting one means.
 */
export function DealerSearchBox({
  q,
  district,
  city,
  districtName,
  onSearch,
  className,
}: DealerSearchBoxProps) {
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

        const response = await fetch(`${DEALER_SUGGEST_PATH}?${params.toString()}`, {
          signal,
          headers: { Accept: 'application/json' },
        });

        // Any non-2xx is a failed suggestion and the panel says so: a 429 and a
        // 502 both mean "not right now", and the grid behind is unaffected
        // either way because it was rendered from a different call.
        if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`);

        return readJson<DealerSuggestResponse>(response);
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
      label={DEALER_SEARCH_TEXT.label}
      placeholder={
        districtName
          ? DEALER_SEARCH_TEXT.placeholderInDistrict(districtName)
          : DEALER_SEARCH_TEXT.placeholder
      }
      groupLabel={
        districtName
          ? DEALER_SEARCH_TEXT.groupLabelInDistrict(districtName)
          : DEALER_SEARCH_TEXT.groupLabel
      }
      emptyMessage={(search) =>
        search ? DEALER_SEARCH_TEXT.noMatch(search) : DEALER_SEARCH_TEXT.noMatchGeneric
      }
    >
      {({ items, highlighted, search, optionProps }) =>
        items.map((item, index) => (
          <DealerSuggestionRow
            key={item.slug}
            item={item}
            index={index}
            highlighted={highlighted}
            search={search}
            optionProps={optionProps}
          />
        ))
      }
    </AutocompletePanel>
  );
}
