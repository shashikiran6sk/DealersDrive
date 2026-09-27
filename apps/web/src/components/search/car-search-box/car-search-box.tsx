'use client';

import type { CarSuggestion, CarSuggestResponse } from '@dealers-drive/contracts';
import { useEffect, useMemo, useState } from 'react';

import { useSearchNavigation } from '@/components/search/search-navigation';
import {
  AutocompletePanel,
  useAutocomplete,
  type AutocompleteSource,
} from '@/components/ui/autocomplete';
import { cn } from '@/lib/cn';
import { readJson } from '@/lib/fetch-json';
import { searchHref, setParam } from '@/lib/vehicle-search';

import { CAR_SEARCH_TEXT, CAR_SUGGEST_PATH } from './car-search-box.constants';
import type { CarSearchBoxProps } from './car-search-box.types';
import { CarSuggestionRow } from './car-suggestion-row';
import { suggestionKey, suggestionParams, suggestQuery } from './utils';

export function CarSearchBox({ params, basePath, districtName, className }: CarSearchBoxProps) {
  const { navigate } = useSearchNavigation();
  const applied = params.q ?? '';
  const [seen, setSeen] = useState(applied);

  const { district, city, dealer } = params;

  const source = useMemo<AutocompleteSource<CarSuggestion>>(
    () => ({
      async suggest(search, signal) {
        const response = await fetch(
          `${CAR_SUGGEST_PATH}?${suggestQuery({ district, city, dealer }, search)}`,
          { signal, headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`);
        return readJson<CarSuggestResponse>(response);
      },
      keyOf: suggestionKey,
      valueOf: (item) => item.variant ?? '',
    }),
    [district, city, dealer],
  );

  const autocomplete = useAutocomplete<CarSuggestion>({
    source,
    initialValue: applied,
    onSelect: (item) => navigate(searchHref(basePath, suggestionParams(params, item))),
    onClear: () => {
      if (applied) navigate(searchHref(basePath, setParam(params, 'q', undefined)));
    },
  });

  const { value, reset, close } = autocomplete;

  useEffect(() => {
    if (applied === seen) return;
    setSeen(applied);
    if (value.trim() !== applied) reset(applied);
  }, [applied, seen, value, reset]);

  function submit(): void {
    const next = value.trim().replace(/\s+/g, ' ');
    close();
    if (next === applied) return;
    navigate(searchHref(basePath, setParam(params, 'q', next || undefined)));
  }

  return (
    <form
      role="search"
      className={cn('w-full sm:w-[300px]', className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <AutocompletePanel
        autocomplete={autocomplete}
        label={CAR_SEARCH_TEXT.label}
        placeholder={
          districtName
            ? CAR_SEARCH_TEXT.placeholderInDistrict(districtName)
            : CAR_SEARCH_TEXT.placeholder
        }
        groupLabel={
          districtName
            ? CAR_SEARCH_TEXT.groupLabelInDistrict(districtName)
            : CAR_SEARCH_TEXT.groupLabel
        }
        emptyMessage={(search) =>
          search ? CAR_SEARCH_TEXT.noMatch(search) : CAR_SEARCH_TEXT.noMatchGeneric
        }
      >
        {({ items, highlighted, search, optionProps }) =>
          items.map((item, index) => (
            <CarSuggestionRow
              key={suggestionKey(item)}
              item={item}
              index={index}
              highlighted={highlighted}
              search={search}
              optionProps={optionProps}
            />
          ))
        }
      </AutocompletePanel>
    </form>
  );
}
