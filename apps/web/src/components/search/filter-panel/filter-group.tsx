'use client';

import type { ReactNode } from 'react';

import { FILTER_PANEL_TEXT } from './filter-panel.constants';

export interface FilterGroupProps {
  label: string;
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}

export function FilterGroup({ label, activeCount, onClear, children }: FilterGroupProps) {
  return (
    <fieldset className="min-w-0 border-t border-(--color-divider) pt-[14px] first:border-t-0 first:pt-0">
      <legend className="sr-only">{label}</legend>
      <div className="mb-[10px] flex min-h-[24px] items-center justify-between gap-2">
        <h3
          aria-hidden="true"
          className="font-heading text-[12px] font-extrabold tracking-[0.06em]"
        >
          {label}
          {activeCount > 0 ? (
            <span className="ml-[6px] tnum text-(--color-accent)">({activeCount})</span>
          ) : null}
        </h3>
        {activeCount > 0 ? (
          <button
            type="button"
            className="btn btn-ghost px-[6px] py-[2px] text-[12px]"
            aria-label={FILTER_PANEL_TEXT.clearGroupLabel(label)}
            onClick={onClear}
          >
            {FILTER_PANEL_TEXT.clearGroup}
          </button>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}
