'use client';

import type { DealerSuggestion } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { HighlightedText, type UseAutocomplete } from '@/components/ui/autocomplete';
import { cn } from '@/lib/cn';

import { DEALER_SEARCH_TEXT } from './dealer-search-box.constants';

export interface DealerSuggestionRowProps {
  item: DealerSuggestion;
  index: number;
  highlighted: number;
  search: string;
  optionProps: UseAutocomplete<DealerSuggestion>['optionProps'];
}

/** One row of the dropdown: monogram, name, the place, and what Enter will do. */
export function DealerSuggestionRow({
  item,
  index,
  highlighted,
  search,
  optionProps,
}: DealerSuggestionRowProps): ReactNode {
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
          {item.initials}
        </span>
        <span className="flex min-w-0 flex-col gap-px">
          <span
            className={cn(
              'truncate text-[13.5px]',
              isHighlighted && 'font-semibold text-(--color-accent-800)',
            )}
          >
            {/*
              Marked only when the name is *why* this row is here: a dealership
              offered because its town matched has none of the typed characters
              in its name, and underlining nothing is the honest rendering.
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
              <HighlightedText text={item.metaLabel} match={search} />
            )}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-[8px]">
        <span className="tag tag-ok text-[10.5px]">{DEALER_SEARCH_TEXT.verified}</span>
        {/*
          Hidden rather than absent on the other rows: rendering it only on the
          highlighted row takes ~70px from that row alone, so the meta line
          truncates on whichever row the buyer is on and the list appears to
          reflow under the arrow keys.
        */}
        <span
          aria-hidden={!isHighlighted}
          className={cn(
            'hidden text-[10px] ink-subtle font-mono sm:inline',
            !isHighlighted && 'invisible',
          )}
        >
          {DEALER_SEARCH_TEXT.selectHint}
        </span>
      </span>
    </li>
  );
}
