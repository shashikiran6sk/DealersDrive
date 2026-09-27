'use client';

import type { VehicleFacets } from '@dealers-drive/contracts';
import { useState } from 'react';

import { FilterPanel, type FilterGroupKey } from '@/components/search/filter-panel';
import { useSearchNavigation } from '@/components/search/search-navigation';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import {
  activeFilterCount,
  clearFilters,
  searchHref,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import { MOBILE_FILTER_SHEET_TEXT } from './mobile-filter-sheet.constants';

export interface MobileFilterSheetProps {
  facets: VehicleFacets;
  params: VehicleSearchParams;
  basePath: string;
  total: number;
  groups?: readonly FilterGroupKey[];
  className?: string;
}

export function MobileFilterSheet({
  facets,
  params,
  basePath,
  total,
  groups,
  className,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const { navigate, pending } = useSearchNavigation();
  const active = activeFilterCount(params);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      variant="sheet"
      title={MOBILE_FILTER_SHEET_TEXT.title}
      closeLabel={MOBILE_FILTER_SHEET_TEXT.close}
      trigger={
        <button
          type="button"
          className={cn('btn btn-secondary h-11 gap-[7px] lg:hidden', className)}
          aria-label={MOBILE_FILTER_SHEET_TEXT.openLabel(active)}
        >
          {MOBILE_FILTER_SHEET_TEXT.open}
          {active > 0 ? (
            <span
              aria-hidden="true"
              className="tag min-w-[20px] justify-center bg-(--color-accent) px-[6px] text-[11px] text-white tnum"
            >
              {active}
            </span>
          ) : null}
        </button>
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost h-11"
            aria-label={MOBILE_FILTER_SHEET_TEXT.clearAllLabel}
            disabled={active === 0}
            onClick={() => {
              navigate(searchHref(basePath, clearFilters(params)));
            }}
          >
            {MOBILE_FILTER_SHEET_TEXT.clearAll}
          </button>
          <button
            type="button"
            className="btn btn-primary h-11 min-w-[160px] flex-1 sm:flex-none"
            aria-live="polite"
            onClick={() => {
              setOpen(false);
            }}
          >
            {pending ? MOBILE_FILTER_SHEET_TEXT.updating : MOBILE_FILTER_SHEET_TEXT.show(total)}
          </button>
        </>
      }
    >
      <FilterPanel
        facets={facets}
        params={params}
        basePath={basePath}
        idPrefix="sheet"
        framed={false}
        {...(groups ? { groups } : {})}
      />
    </Dialog>
  );
}
