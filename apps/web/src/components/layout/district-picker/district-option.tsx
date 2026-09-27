'use client';

import type { DistrictChip } from '@dealers-drive/contracts';

import { cn } from '@/lib/cn';
import { pluralLabel } from '@/lib/plural';

import { DISTRICT_PICKER_TEXT } from './district-picker.constants';
import type { DistrictUnit } from './district-picker.types';

export interface DistrictOptionProps {
  district: DistrictChip;
  count?: number;
  unit?: DistrictUnit;
  selected: boolean;
  showState?: boolean;
  onSelect: (slug: string) => void;
}

export function DistrictOption({
  district,
  count = district.count,
  unit = 'dealership',
  selected,
  showState = false,
  onSelect,
}: DistrictOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        onSelect(district.slug);
      }}
      className={cn(
        'flex min-h-11 items-center gap-[8px] border p-[10px] text-left transition-colors duration-[120ms] ease-out',
        selected
          ? 'border-(--color-accent) bg-(--color-accent-100)'
          : 'border-(--color-divider) bg-white hover:bg-(--color-bg) hover:border-[color-mix(in_srgb,var(--color-ink)_45%,transparent)]',
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[13px] font-medium',
            selected && 'text-(--color-accent-700)',
          )}
        >
          {district.name}
        </span>
        <span className="block truncate text-[11px] ink-subtle">
          {showState ? (
            <>
              {district.state ?? DISTRICT_PICKER_TEXT.unknownState}
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span className="tnum">{count}</span> {pluralLabel(count, unit)}
        </span>
      </span>
      {selected ? (
        <span className="flex-none text-[13px] text-(--color-accent)" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}
