'use client';

import type { FacetOption } from '@dealers-drive/contracts';
import { useState } from 'react';

import { slugify } from '@dealers-drive/contracts';

import { COLLAPSED_ROWS, FILTER_PANEL_TEXT } from './filter-panel.constants';
import { FacetRow } from './facet-row';
import { visibleOptions } from './utils';

export interface FacetCheckboxListProps {
  name: string;
  idPrefix: string;
  options: readonly FacetOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  limit?: number;
}

export function FacetCheckboxList({
  name,
  idPrefix,
  options,
  selected,
  onToggle,
  limit = COLLAPSED_ROWS,
}: FacetCheckboxListProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = visibleOptions(options, selected, expanded, limit);

  return (
    <>
      <ul className="flex flex-col gap-[7px]">
        {shown.map((option) => (
          <FacetRow
            key={option.value}
            type="checkbox"
            name={name}
            id={`${idPrefix}-${name}-${slugify(option.value) || option.value}`}
            label={option.label}
            count={option.count}
            checked={selected.has(option.value)}
            onChange={() => {
              onToggle(option.value);
            }}
          />
        ))}
      </ul>
      {options.length > limit ? (
        <button
          type="button"
          className="btn btn-ghost mt-[6px] px-[6px] py-[2px] text-[12px]"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((open) => !open);
          }}
        >
          {expanded ? FILTER_PANEL_TEXT.showFewer : FILTER_PANEL_TEXT.showAll(options.length)}
        </button>
      ) : null}
    </>
  );
}
