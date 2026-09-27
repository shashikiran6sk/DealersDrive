import type { FacetOption, RangeFacet } from '@dealers-drive/contracts';

import {
  csvOf,
  setCsv,
  toggleCsv,
  type CsvParamKey,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

export function isPreset(
  band: Pick<RangeFacet, 'min' | 'max'>,
  range: { min: number | null; max: number | null },
): boolean {
  return band.min === range.min && band.max === range.max;
}

export function toggleBrand(
  params: VehicleSearchParams,
  brand: string,
  models: readonly FacetOption[],
): VehicleSearchParams {
  const next = toggleCsv(params, 'brand', brand);
  if (csvOf(next, 'brand').includes(brand)) return next;
  const orphaned = new Set(
    models.filter((model) => model.parent === brand).map((model) => model.value),
  );
  return setCsv(
    next,
    'model',
    csvOf(next, 'model').filter((model) => !orphaned.has(model)),
  );
}

export function toggleValue(
  params: VehicleSearchParams,
  key: CsvParamKey,
  value: string,
  models: readonly FacetOption[],
): VehicleSearchParams {
  return key === 'brand' ? toggleBrand(params, value, models) : toggleCsv(params, key, value);
}

export function visibleOptions(
  options: readonly FacetOption[],
  selected: ReadonlySet<string>,
  expanded: boolean,
  limit: number,
): FacetOption[] {
  if (expanded || options.length <= limit) return [...options];
  const head = options.slice(0, limit);
  const extra = options.slice(limit).filter((option) => selected.has(option.value));
  return [...head, ...extra];
}
