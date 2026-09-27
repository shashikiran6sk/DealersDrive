'use client';

import type { CarSuggestion } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { HighlightedText, type UseAutocomplete } from '@/components/ui/autocomplete';
import { cn } from '@/lib/cn';

import { CAR_SEARCH_TEXT } from './car-search-box.constants';

export interface CarSuggestionRowProps {
  item: CarSuggestion;
  index: number;
  highlighted: number;
  search: string;
  optionProps: UseAutocomplete<CarSuggestion>['optionProps'];
}

export function CarSuggestionRow({
  item,
  index,
  highlighted,
  search,
  optionProps,
}: CarSuggestionRowProps): ReactNode {
  const isHighlighted = index === highlighted;

  return (
    <li
      {...optionProps(item, index)}
      className={cn(
        'flex cursor-pointer select-none items-center justify-between gap-[10px] border-b border-(--color-divider) px-[12px] py-[8px] last:border-b-0',
        isHighlighted &&
          'border-l-[3px] border-l-(--color-accent) bg-(--color-accent-100) pl-[9px]',
      )}
    >
      <span className="flex min-w-0 items-center gap-[10px]">
        <span
          className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bg-(--color-accent-200) text-[11px] font-bold text-(--color-accent-800) font-heading"
          aria-hidden="true"
        >
          {CAR_SEARCH_TEXT.kind[item.kind]}
        </span>
        <span className="flex min-w-0 flex-col gap-px">
          <span
            className={cn(
              'truncate text-[13.5px]',
              isHighlighted && 'font-semibold text-(--color-accent-800)',
            )}
          >
            <HighlightedText text={item.label} match={search} />
          </span>
          <span className="truncate text-[11px] ink-subtle tnum">{item.metaLabel}</span>
        </span>
      </span>

      <span
        aria-hidden={!isHighlighted}
        className={cn(
          'hidden shrink-0 text-[10px] ink-subtle font-mono sm:inline',
          !isHighlighted && 'invisible',
        )}
      >
        {CAR_SEARCH_TEXT.selectHint}
      </span>
    </li>
  );
}
