'use client';

import { VEHICLE_SORT_LABELS, VehicleSort } from '@dealers-drive/contracts';

import { useSearchNavigation } from '@/components/search/search-navigation';
import { Select } from '@/components/ui/input';
import { searchHref, setParam, type VehicleSearchParams } from '@/lib/vehicle-search';

import { SEARCH_TOOLBAR_TEXT } from './search-toolbar.constants';

const DEFAULT_SORT: VehicleSort = 'newest';

export interface SortSelectProps {
  params: VehicleSearchParams;
  basePath: string;
  id: string;
  className?: string;
}

export function SortSelect({ params, basePath, id, className }: SortSelectProps) {
  const { navigate } = useSearchNavigation();
  const current = VehicleSort.safeParse(params.sort);

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {SEARCH_TOOLBAR_TEXT.sortLabel}
      </label>
      <Select
        id={id}
        className={className ?? 'w-full min-w-[180px] sm:w-auto'}
        value={current.success ? current.data : DEFAULT_SORT}
        onChange={(event) => {
          const next = VehicleSort.safeParse(event.target.value);
          if (!next.success) return;
          navigate(
            searchHref(
              basePath,
              setParam(params, 'sort', next.data === DEFAULT_SORT ? undefined : next.data),
            ),
          );
        }}
      >
        {VehicleSort.options.map((option) => (
          <option key={option} value={option}>
            {VEHICLE_SORT_LABELS[option]}
          </option>
        ))}
      </Select>
    </>
  );
}
