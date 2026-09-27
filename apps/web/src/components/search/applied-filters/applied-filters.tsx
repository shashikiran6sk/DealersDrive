'use client';

import type { VehicleFacets } from '@dealers-drive/contracts';

import { useSearchNavigation } from '@/components/search/search-navigation';
import {
  activeFilterCount,
  clearFilters,
  searchHref,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import { APPLIED_FILTERS_TEXT } from './applied-filters.constants';
import { appliedFilters } from './utils';

export interface AppliedFiltersProps {
  facets: VehicleFacets;
  params: VehicleSearchParams;
  basePath: string;
}

export function AppliedFilters({ facets, params, basePath }: AppliedFiltersProps) {
  const { navigate } = useSearchNavigation();
  const chips = appliedFilters(params, facets);
  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-[7px]"
      role="group"
      aria-label={APPLIED_FILTERS_TEXT.label}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="tag tag-outline cursor-pointer gap-[7px] text-[11px]"
          aria-label={APPLIED_FILTERS_TEXT.remove(chip.label)}
          onClick={() => {
            navigate(searchHref(basePath, chip.without));
          }}
        >
          {chip.label}
          <span aria-hidden="true">✕</span>
        </button>
      ))}
      {activeFilterCount(params) > 0 ? (
        <button
          type="button"
          className="btn btn-ghost px-[6px] py-[2px] text-[12px]"
          aria-label={APPLIED_FILTERS_TEXT.clearAllLabel}
          onClick={() => {
            navigate(searchHref(basePath, clearFilters(params)));
          }}
        >
          {APPLIED_FILTERS_TEXT.clearAll}
        </button>
      ) : null}
    </div>
  );
}
