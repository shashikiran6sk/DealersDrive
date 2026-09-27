import {
  formatKm,
  formatLakh,
  type FacetOption,
  type RangeFacet,
  type VehicleFacets,
} from '@dealers-drive/contracts';

import {
  csvOf,
  KM_KEYS,
  PRICE_KEYS,
  rangeOf,
  setParam,
  setRange,
  toggleCsv,
  YEAR_KEYS,
  type CsvParamKey,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import { APPLIED_FILTERS_TEXT } from './applied-filters.constants';

export interface AppliedFilter {
  key: string;
  label: string;
  without: VehicleSearchParams;
}

const CSV_FACETS: [CsvParamKey, keyof VehicleFacets][] = [
  ['city', 'cities'],
  ['dealer', 'dealers'],
  ['brand', 'brands'],
  ['model', 'models'],
  ['fuel', 'fuelTypes'],
  ['transmission', 'transmissions'],
  ['bodyType', 'bodyTypes'],
  ['color', 'colors'],
  ['owners', 'ownerCounts'],
];

function isOptionList(value: unknown): value is FacetOption[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'object' && entry !== null && 'value' in entry)
  );
}

function labelOf(options: readonly FacetOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function span(
  range: { min: number | null; max: number | null },
  format: (value: number) => string,
): string {
  return [range.min, range.max]
    .map((value) => (value === null ? APPLIED_FILTERS_TEXT.openEnded : format(value)))
    .join(' – ');
}

function presetLabel(
  bands: readonly RangeFacet[],
  range: { min: number | null; max: number | null },
): string | undefined {
  return bands.find((band) => band.min === range.min && band.max === range.max)?.label;
}

export function appliedFilters(
  params: VehicleSearchParams,
  facets: VehicleFacets,
): AppliedFilter[] {
  const chips: AppliedFilter[] = [];

  if (params.q) {
    chips.push({
      key: 'q',
      label: APPLIED_FILTERS_TEXT.search(params.q),
      without: setParam(params, 'q', undefined),
    });
  }

  for (const [key, facet] of CSV_FACETS) {
    const options = facets[facet];
    const list = isOptionList(options) ? options : [];
    for (const value of csvOf(params, key)) {
      chips.push({
        key: `${key}:${value}`,
        label: labelOf(list, value),
        without: toggleCsv(params, key, value),
      });
    }
  }

  const price = rangeOf(params, PRICE_KEYS);
  if (price.min !== null || price.max !== null) {
    chips.push({
      key: 'price',
      label: APPLIED_FILTERS_TEXT.price(
        presetLabel(facets.price, price) ?? span(price, formatLakh),
      ),
      without: setRange(params, PRICE_KEYS, null, null),
    });
  }

  const year = rangeOf(params, YEAR_KEYS);
  if (year.min !== null || year.max !== null) {
    chips.push({
      key: 'year',
      label: APPLIED_FILTERS_TEXT.year(span(year, String)),
      without: setRange(params, YEAR_KEYS, null, null),
    });
  }

  const km = rangeOf(params, KM_KEYS);
  if (km.min !== null || km.max !== null) {
    chips.push({
      key: 'km',
      label: APPLIED_FILTERS_TEXT.km(presetLabel(facets.kilometers, km) ?? span(km, formatKm)),
      without: setRange(params, KM_KEYS, null, null),
    });
  }

  return chips;
}
