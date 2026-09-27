import { countLabel } from '@/lib/plural';

import type { FilterGroupKey } from './filter-panel.types';

export const ALL_FILTER_GROUPS: readonly FilterGroupKey[] = [
  'city',
  'brand',
  'model',
  'price',
  'year',
  'km',
  'fuel',
  'transmission',
  'bodyType',
  'color',
  'owners',
  'dealer',
];

export const PORTFOLIO_FILTER_GROUPS: readonly FilterGroupKey[] = ALL_FILTER_GROUPS.filter(
  (group) => group !== 'city' && group !== 'dealer',
);

export const FILTER_GROUP_LABELS: Record<FilterGroupKey, string> = {
  city: 'City / Town',
  brand: 'Brand',
  model: 'Model',
  price: 'Price',
  year: 'Year',
  km: 'Kilometers driven',
  fuel: 'Fuel type',
  transmission: 'Transmission',
  bodyType: 'Body type',
  color: 'Color',
  owners: 'Owners',
  dealer: 'Dealer',
};

export const COLLAPSED_ROWS = 6;

export const FILTER_PANEL_TEXT = {
  heading: 'Filters',
  clearAll: 'Clear all',
  clearAllLabel: 'Clear every filter',
  clearGroup: 'Clear',
  clearGroupLabel: (group: string) => `Clear ${group.toLowerCase()}`,
  showAll: (count: number) => `Show all ${String(count)}`,
  showFewer: 'Show fewer',
  anyPrice: 'Any price',
  anyKm: 'Any distance',
  customRange: 'Custom range',
  modelHint: 'Choose a brand to see its models.',
  nothingHere: 'Nothing to filter by here yet.',
  yearFrom: 'From',
  yearTo: 'To',
  anyYear: 'Any',
  yearFromLabel: 'Earliest year',
  yearToLabel: 'Latest year',
  selectedCount: (count: number) => countLabel(count, 'selected', 'selected'),
  named: (label: string, count: number) =>
    `${label} (${String(count)} ${count === 1 ? 'car' : 'cars'})`,
} as const;
