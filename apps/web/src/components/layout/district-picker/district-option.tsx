'use client';

import type { DistrictChip } from '@dealers-drive/contracts';

import { cn } from '@/lib/cn';
import { pluralLabel } from '@/lib/plural';

import { DISTRICT_PICKER_TEXT } from './district-picker.constants';

export interface DistrictOptionProps {
  district: DistrictChip;
  selected: boolean;
  showState?: boolean;
  onSelect: (slug: string) => void;
}

/**
 * A district — the only selectable thing in the dialog.
 *
 * A real `<button>`, so Tab reaches it and Enter and Space choose it (§2.1:
 * never a `<div>` with an `onClick`). `min-h-11` is 44px, the mobile touch
 * minimum (§4.15).
 *
 * Selection is announced three ways over, because colour alone is not a status
 * (§4.15): `aria-pressed` for a screen reader, a ✓ for an eye, and the cobalt
 * border and `accent-100` fill for a glance. No shadow — §4.1 allows the dialog
 * one and nothing inside it.
 */
export function DistrictOption({
  district,
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
          <span className="tnum">{district.count}</span> {pluralLabel(district.count, 'dealership')}
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
