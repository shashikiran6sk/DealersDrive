'use client';

import { formatKm, formatLakh, type FacetOption } from '@dealers-drive/contracts';
import { useOptimistic, type ReactNode } from 'react';

import { useSearchNavigation } from '@/components/search/search-navigation';
import { cn } from '@/lib/cn';
import {
  activeFilterCount,
  clearFilters,
  csvOf,
  KM_KEYS,
  PRICE_KEYS,
  rangeOf,
  searchHref,
  setParam,
  setRange,
  YEAR_KEYS,
  type CsvParamKey,
  type VehicleSearchParams,
} from '@/lib/vehicle-search';

import {
  ALL_FILTER_GROUPS,
  FILTER_GROUP_LABELS,
  FILTER_PANEL_TEXT,
} from './filter-panel.constants';
import type { FilterGroupKey, FilterPanelProps } from './filter-panel.types';
import { FacetCheckboxList } from './facet-checkbox-list';
import { FilterGroup } from './filter-group';
import { RangePresets } from './range-presets';
import { toggleValue } from './utils';
import { YearRange } from './year-range';

const CSV_GROUPS: Partial<Record<FilterGroupKey, { key: CsvParamKey; facet: keyof FacetLists }>> = {
  city: { key: 'city', facet: 'cities' },
  brand: { key: 'brand', facet: 'brands' },
  model: { key: 'model', facet: 'models' },
  fuel: { key: 'fuel', facet: 'fuelTypes' },
  transmission: { key: 'transmission', facet: 'transmissions' },
  bodyType: { key: 'bodyType', facet: 'bodyTypes' },
  color: { key: 'color', facet: 'colors' },
  owners: { key: 'owners', facet: 'ownerCounts' },
  dealer: { key: 'dealer', facet: 'dealers' },
};

type FacetLists = Pick<
  FilterPanelProps['facets'],
  | 'cities'
  | 'brands'
  | 'models'
  | 'fuelTypes'
  | 'transmissions'
  | 'bodyTypes'
  | 'colors'
  | 'ownerCounts'
  | 'dealers'
>;

const LOCATION_GROUPS: ReadonlySet<FilterGroupKey> = new Set(['city', 'dealer']);

const FIXED_LISTS: ReadonlySet<FilterGroupKey> = new Set(['color']);

function describePrice(range: { min: number | null; max: number | null }): string {
  return [range.min, range.max]
    .map((value) => (value === null ? '…' : formatLakh(value)))
    .join(' – ');
}

function describeKm(range: { min: number | null; max: number | null }): string {
  return [range.min, range.max]
    .map((value) => (value === null ? '…' : formatKm(value)))
    .join(' – ');
}

export function FilterPanel({
  facets,
  params: applied,
  basePath,
  groups = ALL_FILTER_GROUPS,
  idPrefix = 'filters',
  heading = FILTER_PANEL_TEXT.heading,
  framed = true,
  className,
}: FilterPanelProps) {
  const { navigate, pending } = useSearchNavigation();
  const [params, setParams] = useOptimistic(applied);

  function go(next: VehicleSearchParams): void {
    navigate(searchHref(basePath, next), {
      optimistic: () => {
        setParams(next);
      },
    });
  }

  function csvGroup(group: FilterGroupKey, options: readonly FacetOption[]): ReactNode {
    const spec = CSV_GROUPS[group];
    if (!spec) return null;
    const selected = new Set(csvOf(params, spec.key));
    if (options.length === 0 && selected.size === 0) return null;

    return (
      <FilterGroup
        key={group}
        label={FILTER_GROUP_LABELS[group]}
        activeCount={selected.size}
        onClear={() => {
          const cleared = setParam(params, spec.key, undefined);
          go(spec.key === 'brand' ? setParam(cleared, 'model', undefined) : cleared);
        }}
      >
        <FacetCheckboxList
          {...(FIXED_LISTS.has(group) ? { limit: options.length } : {})}
          name={spec.key}
          idPrefix={idPrefix}
          options={options}
          selected={selected}
          onToggle={(value) => {
            go(toggleValue(params, spec.key, value, facets.models));
          }}
        />
      </FilterGroup>
    );
  }

  function rangeGroup(group: 'price' | 'km'): ReactNode {
    const keys = group === 'price' ? PRICE_KEYS : KM_KEYS;
    const bands = group === 'price' ? facets.price : facets.kilometers;
    const range = rangeOf(params, keys);
    const active = range.min !== null || range.max !== null;

    return (
      <FilterGroup
        key={group}
        label={FILTER_GROUP_LABELS[group]}
        activeCount={active ? 1 : 0}
        onClear={() => {
          go(setRange(params, keys, null, null));
        }}
      >
        <RangePresets
          name={group}
          idPrefix={idPrefix}
          bands={bands}
          range={range}
          anyLabel={group === 'price' ? FILTER_PANEL_TEXT.anyPrice : FILTER_PANEL_TEXT.anyKm}
          describe={group === 'price' ? describePrice : describeKm}
          onSelect={(min, max) => {
            go(setRange(params, keys, min, max));
          }}
        />
      </FilterGroup>
    );
  }

  function yearGroup(): ReactNode {
    const range = rangeOf(params, YEAR_KEYS);
    const active = range.min !== null || range.max !== null;
    if (facets.years.length === 0 && !active) return null;

    return (
      <FilterGroup
        key="year"
        label={FILTER_GROUP_LABELS.year}
        activeCount={active ? 1 : 0}
        onClear={() => {
          go(setRange(params, YEAR_KEYS, null, null));
        }}
      >
        <YearRange
          idPrefix={idPrefix}
          years={facets.years}
          range={range}
          onChange={(min, max) => {
            go(setRange(params, YEAR_KEYS, min, max));
          }}
        />
      </FilterGroup>
    );
  }

  function modelGroup(): ReactNode {
    const brands = csvOf(params, 'brand');
    const models = csvOf(params, 'model');
    if (brands.length > 0 || models.length > 0) return csvGroup('model', facets.models);
    if (facets.brands.length === 0) return null;

    return (
      <FilterGroup
        key="model"
        label={FILTER_GROUP_LABELS.model}
        activeCount={0}
        onClear={() => undefined}
      >
        <p className="text-[12px] ink-subtle">{FILTER_PANEL_TEXT.modelHint}</p>
      </FilterGroup>
    );
  }

  const sections = groups.map((group) => {
    if (LOCATION_GROUPS.has(group) && !params.district) return null;
    if (group === 'price' || group === 'km') return rangeGroup(group);
    if (group === 'year') return yearGroup();
    if (group === 'model') return modelGroup();
    const spec = CSV_GROUPS[group];
    return spec ? csvGroup(group, facets[spec.facet]) : null;
  });

  const active = activeFilterCount(params);
  const hasInventory = facets.price.some((band) => band.count > 0) || active > 0;

  const body = hasInventory ? (
    sections
  ) : (
    <p className="text-[13px] ink-muted">{FILTER_PANEL_TEXT.nothingHere}</p>
  );

  if (!framed) {
    return (
      <div className={cn('flex flex-col gap-[18px]', className)} aria-busy={pending}>
        {body}
      </div>
    );
  }

  return (
    <div className={cn('card gap-[18px] p-[16px]', className)} aria-busy={pending}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px]">{heading}</h2>
        {active > 0 ? (
          <button
            type="button"
            className="btn btn-ghost px-[6px] py-[2px] text-[12px]"
            aria-label={FILTER_PANEL_TEXT.clearAllLabel}
            onClick={() => {
              go(clearFilters(params));
            }}
          >
            {FILTER_PANEL_TEXT.clearAll}
          </button>
        ) : null}
      </div>
      {body}
    </div>
  );
}
