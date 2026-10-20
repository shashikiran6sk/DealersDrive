import { DealerVehicleQuery, PublicVehicleQuery } from '@dealers-drive/contracts';

import { one, type SearchParamsInput } from './url';

export const VEHICLE_PARAM_ORDER = [
  'district',
  'city',
  'dealer',
  'q',
  'brand',
  'model',
  'minPrice',
  'maxPrice',
  'minYear',
  'maxYear',
  'minKm',
  'maxKm',
  'fuel',
  'transmission',
  'bodyType',
  'color',
  'owners',
  'sort',
  'page',
] as const;

export type VehicleParamKey = (typeof VEHICLE_PARAM_ORDER)[number];

export type VehicleSearchParams = Partial<Record<VehicleParamKey, string>>;

export type CsvParamKey =
  'city' | 'dealer' | 'brand' | 'model' | 'fuel' | 'transmission' | 'bodyType' | 'color' | 'owners';

export type RangeParamKeys =
  readonly ['minPrice', 'maxPrice'] | readonly ['minYear', 'maxYear'] | readonly ['minKm', 'maxKm'];

export const PRICE_KEYS = ['minPrice', 'maxPrice'] as const;
export const YEAR_KEYS = ['minYear', 'maxYear'] as const;
export const KM_KEYS = ['minKm', 'maxKm'] as const;

const DEFAULT_SORT = 'newest';

const LOCATION_KEYS: readonly VehicleParamKey[] = ['district', 'city', 'dealer'];

const KEPT_BY_CLEAR: readonly VehicleParamKey[] = ['district', 'q', 'sort'];

export type SearchScope = 'marketplace' | 'dealer';

function schemaFor(scope: SearchScope) {
  return scope === 'marketplace' ? PublicVehicleQuery : DealerVehicleQuery;
}

function keysFor(scope: SearchScope): readonly VehicleParamKey[] {
  return scope === 'marketplace'
    ? VEHICLE_PARAM_ORDER
    : VEHICLE_PARAM_ORDER.filter((key) => !LOCATION_KEYS.includes(key));
}

export function readVehicleSearch(
  params: SearchParamsInput,
  scope: SearchScope = 'marketplace',
): VehicleSearchParams {
  const raw: VehicleSearchParams = {};
  for (const key of keysFor(scope)) {
    const value = one(params, key)?.trim();
    if (value) raw[key] = value;
  }

  const schema = schemaFor(scope);
  let candidate = raw;
  for (let attempt = 0; attempt < VEHICLE_PARAM_ORDER.length; attempt += 1) {
    const result = schema.safeParse(candidate);
    if (result.success) return candidate;
    const bad = new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '')));
    candidate = Object.fromEntries(Object.entries(candidate).filter(([key]) => !bad.has(key)));
  }
  return {};
}

export function csvOf(params: VehicleSearchParams, key: CsvParamKey): string[] {
  return (params[key] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function searchHref(basePath: string, params: VehicleSearchParams): string {
  const search = new URLSearchParams();
  for (const key of VEHICLE_PARAM_ORDER) {
    const value = params[key];
    if (value === undefined || value === '') continue;
    if (key === 'sort' && value === DEFAULT_SORT) continue;
    if (key === 'page' && value === '1') continue;
    search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `${basePath}?${encoded}` : basePath;
}

function withoutPage(params: VehicleSearchParams): VehicleSearchParams {
  const next = { ...params };
  delete next.page;
  return next;
}

export function setParam(
  params: VehicleSearchParams,
  key: VehicleParamKey,
  value: string | undefined,
): VehicleSearchParams {
  const next = key === 'page' ? { ...params } : withoutPage(params);
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next;
}

export function setCsv(
  params: VehicleSearchParams,
  key: CsvParamKey,
  values: readonly string[],
): VehicleSearchParams {
  return setParam(params, key, [...new Set(values)].sort().join(','));
}

export function toggleCsv(
  params: VehicleSearchParams,
  key: CsvParamKey,
  value: string,
): VehicleSearchParams {
  const current = csvOf(params, key);
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return setCsv(params, key, next);
}

export function setRange(
  params: VehicleSearchParams,
  keys: RangeParamKeys,
  min: number | null,
  max: number | null,
): VehicleSearchParams {
  const [low, high] = keys;
  const withMin = setParam(params, low, min === null ? undefined : String(min));
  return setParam(withMin, high, max === null ? undefined : String(max));
}

export function rangeOf(
  params: VehicleSearchParams,
  keys: RangeParamKeys,
): { min: number | null; max: number | null } {
  const [low, high] = keys;
  const min = params[low];
  const max = params[high];
  return {
    min: min === undefined ? null : Number(min),
    max: max === undefined ? null : Number(max),
  };
}

export function clearFilters(params: VehicleSearchParams): VehicleSearchParams {
  const next: VehicleSearchParams = {};
  for (const key of KEPT_BY_CLEAR) {
    const value = params[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}

export function activeFilterCount(params: VehicleSearchParams): number {
  let count = 0;
  for (const key of [
    'city',
    'dealer',
    'brand',
    'model',
    'fuel',
    'transmission',
    'bodyType',
    'color',
    'owners',
  ] as const) {
    count += csvOf(params, key).length;
  }
  for (const keys of [PRICE_KEYS, YEAR_KEYS, KM_KEYS]) {
    const range = rangeOf(params, keys);
    if (range.min !== null || range.max !== null) count += 1;
  }
  return count;
}

export function pageOf(params: VehicleSearchParams): number {
  const page = Number(params.page ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}
