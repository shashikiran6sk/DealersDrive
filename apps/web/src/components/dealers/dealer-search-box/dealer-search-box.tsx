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

export function DealerSearchBox({
  q,
  district,
  city,
  districtName,
  onSearch,
  className,
}: DealerSearchBoxProps) {
  const cityParam = city && city.length > 0 ? [...city].sort().join(',') : undefined;

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

        if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`);

        return readJson<DealerSuggestResponse>(response);
      },
      keyOf: (item) => item.slug,
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
