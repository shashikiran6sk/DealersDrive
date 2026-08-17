'use client';

import type { FacetsResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { buildSearchUrl, isChecked, setParam, toggleCsv } from '@/lib/url';

/**
 * DESIGN-SPEC §3.3 and §2.4.
 *
 * A client component that writes to the **URL** rather than to a store: every
 * filter state is therefore server-renderable, shareable and indexable, and
 * the back button works for free (ARCHITECTURE §15.2).
 *
 * Count-0 options are rendered disabled, never hidden — hiding them makes
 * users think the filter is broken (§11.2).
 */
export interface FilterPanelProps {
  facets: FacetsResponse;
  params: Record<string, string>;
  basePath: string;
  /** The portfolio dims zero rows instead of hiding the group (A11). */
  dimZeroRows?: boolean;
  /**
   * Which groups to show. The portfolio omits `dealer` — every car in that
   * inventory belongs to the same dealer, so the group would be a one-row
   * filter that does nothing (DESIGN-SPEC §3.6).
   */
  groups?: readonly FilterGroupKey[];
  onNavigate?: () => void;
}

export type FilterGroupKey = 'fuel' | 'bodyType' | 'transmission' | 'dealer';

const GROUP_LABELS: Record<FilterGroupKey, string> = {
  fuel: 'Fuel',
  bodyType: 'Body type',
  transmission: 'Transmission',
  dealer: 'Dealer',
};

const ALL_GROUPS: readonly FilterGroupKey[] = ['fuel', 'bodyType', 'transmission', 'dealer'];

export function FilterPanel({
  facets,
  params,
  basePath,
  dimZeroRows = false,
  groups: groupKeys = ALL_GROUPS,
  onNavigate,
}: FilterPanelProps) {
  const router = useRouter();

  function go(next: Record<string, string>) {
    router.push(buildSearchUrl(basePath, next), { scroll: false });
    onNavigate?.();
  }

  const groups = groupKeys.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    options: facets[key],
  }));

  return (
    <div className="card gap-[18px]">
      <PriceRange facets={facets} params={params} onCommit={go} />

      {groups.map((group) => (
        <fieldset key={group.key} className="border-t border-(--color-divider) pt-[14px]">
          <legend className="sr-only">{group.label}</legend>
          <h6 className="mb-[10px]">{group.label}</h6>
          <div className="flex flex-col gap-[7px]">
            {group.options.map((option) => {
              const checked = isChecked(params, group.key, option.value);
              const empty = option.count === 0 && !checked;

              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-[9px] text-[13px]"
                  style={dimZeroRows && empty ? { opacity: 0.4 } : undefined}
                >
                  <input
                    type="checkbox"
                    className="h-[15px] w-[15px] accent-(--color-accent)"
                    checked={checked}
                    onChange={() => go(toggleCsv(params, group.key, option.value))}
                  />
                  <span className="flex-1">{option.label}</span>
                  <span className="text-[11px] ink-faint tnum">{option.count}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * §2.4 and §16.4: a slider is unusable across ₹50k–₹1cr on its own, so the
 * value is committed on release and the current position is always readable
 * as a formatted label.
 */
function PriceRange({
  facets,
  params,
  onCommit,
}: {
  facets: FacetsResponse;
  params: Record<string, string>;
  onCommit: (next: Record<string, string>) => void;
}) {
  const min = Math.max(0, facets.priceRange.min);
  const max = Math.max(min + facets.priceRange.step, facets.priceRange.max);
  const current = Number(params.priceMax ?? max);
  const [value, setValue] = useState(current);

  // A navigation (chip removal, Clear all) must move the thumb back.
  useEffect(() => setValue(current), [current]);

  return (
    <div>
      <h6 className="mb-[10px]">Budget</h6>
      <label className="sr-only" htmlFor="budget">
        Maximum price
      </label>
      <input
        id="budget"
        type="range"
        min={min}
        max={max}
        step={facets.priceRange.step}
        value={value}
        className="w-full accent-(--color-accent)"
        onChange={(event) => setValue(Number(event.target.value))}
        onMouseUp={() =>
          onCommit(setParam(params, 'priceMax', value >= max ? undefined : String(value)))
        }
        onTouchEnd={() =>
          onCommit(setParam(params, 'priceMax', value >= max ? undefined : String(value)))
        }
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) {
            onCommit(setParam(params, 'priceMax', value >= max ? undefined : String(value)));
          }
        }}
      />
      <div className="flex justify-between text-[12px] ink-muted tnum">
        <span>{facets.priceRange.minLabel}</span>
        <span>Up to {formatPaise(value)}</span>
      </div>
    </div>
  );
}

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} Lakh`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
