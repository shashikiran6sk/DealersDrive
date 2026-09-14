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

export function DealerSearchBox({
  q,
  district,
  city,
  districtName,
  onSearch,
  className,
}: {
  q?: string;
  district?: string;
  city?: string[];
  districtName?: string;
  onSearch: (term: string | null) => void;
  className?: string;
}) {
  const cityParam = city && city.length > 0 ? [...city].sort().join(',') : undefined;

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

        if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`);

        return (await response.json()) as DealerSuggestResponse;
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
                    <HighlightedText text={item.metaLabel} match={search} />
                  )}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-[8px]">
              <span className="tag tag-ok text-[10.5px]">✓ Verified</span>
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
