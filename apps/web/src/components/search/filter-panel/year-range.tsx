'use client';

import type { FacetOption } from '@dealers-drive/contracts';

import { Select } from '@/components/ui/input';

import { FILTER_PANEL_TEXT } from './filter-panel.constants';

export interface YearRangeProps {
  idPrefix: string;
  years: readonly FacetOption[];
  range: { min: number | null; max: number | null };
  onChange: (min: number | null, max: number | null) => void;
}

function yearOf(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function YearRange({ idPrefix, years, range, onChange }: YearRangeProps) {
  const ascending = [...years].sort((a, b) => Number(a.value) - Number(b.value));
  const descending = [...ascending].reverse();

  return (
    <div className="grid grid-cols-2 gap-[8px]">
      <label
        className="flex flex-col gap-[4px] text-[12px] ink-muted"
        htmlFor={`${idPrefix}-year-min`}
      >
        {FILTER_PANEL_TEXT.yearFrom}
        <Select
          id={`${idPrefix}-year-min`}
          aria-label={FILTER_PANEL_TEXT.yearFromLabel}
          className="w-full text-[13px]"
          value={range.min === null ? '' : String(range.min)}
          onChange={(event) => {
            const min = yearOf(event.target.value);
            onChange(min, min !== null && range.max !== null && min > range.max ? null : range.max);
          }}
        >
          <option value="">{FILTER_PANEL_TEXT.anyYear}</option>
          {ascending.map((year) => (
            <option key={year.value} value={year.value}>
              {year.label}
            </option>
          ))}
        </Select>
      </label>
      <label
        className="flex flex-col gap-[4px] text-[12px] ink-muted"
        htmlFor={`${idPrefix}-year-max`}
      >
        {FILTER_PANEL_TEXT.yearTo}
        <Select
          id={`${idPrefix}-year-max`}
          aria-label={FILTER_PANEL_TEXT.yearToLabel}
          className="w-full text-[13px]"
          value={range.max === null ? '' : String(range.max)}
          onChange={(event) => {
            const max = yearOf(event.target.value);
            onChange(max !== null && range.min !== null && range.min > max ? null : range.min, max);
          }}
        >
          <option value="">{FILTER_PANEL_TEXT.anyYear}</option>
          {descending.map((year) => (
            <option key={year.value} value={year.value}>
              {year.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
