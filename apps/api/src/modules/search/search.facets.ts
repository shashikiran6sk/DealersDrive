import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  OWNER_BUCKET_LABELS,
  OWNER_BUCKET_MIN,
  TRANSMISSION_LABELS,
  VEHICLE_COLOR_LABELS,
  VehicleColor as ColorEnum,
  slugify,
  type FacetOption,
  type OwnerBucket,
  type RangeFacet,
  type RangePreset,
} from '@dealers-drive/contracts';
import type { BodyType, FuelType, Transmission, VehicleColor } from '@prisma/client';

export interface Counted<V> {
  value: V;
  count: number;
}

export interface PublicDealerRow {
  id: string;
  slug: string;
  brandName: string;
  city: string | null;
  district: string | null;
}

export interface LocationQuery {
  district?: string | undefined;
  city?: string[] | undefined;
  dealer?: string[] | undefined;
}

export interface LocationScope {
  inScope: readonly PublicDealerRow[];
  scopeIds: string[] | null;
  resultIds: string[] | null;
  cities: ReadonlySet<string>;
  dealers: ReadonlySet<string>;
}

function slugOf(value: string | null): string {
  return value ? slugify(value) : '';
}

export function locationScope(
  dealers: readonly PublicDealerRow[],
  query: LocationQuery,
): LocationScope {
  const cities = new Set(query.city ?? []);
  const chosen = new Set(query.dealer ?? []);
  const inScope = query.district
    ? dealers.filter((dealer) => slugOf(dealer.district) === query.district)
    : dealers;

  const narrowed = cities.size > 0 || chosen.size > 0;
  const result = inScope.filter(
    (dealer) =>
      (cities.size === 0 || cities.has(slugOf(dealer.city))) &&
      (chosen.size === 0 || chosen.has(dealer.slug)),
  );

  return {
    inScope,
    scopeIds: query.district ? inScope.map((dealer) => dealer.id) : null,
    resultIds: query.district || narrowed ? result.map((dealer) => dealer.id) : null,
    cities,
    dealers: chosen,
  };
}

export function oneDealerScope(dealer: PublicDealerRow): LocationScope {
  return {
    inScope: [dealer],
    scopeIds: [dealer.id],
    resultIds: [dealer.id],
    cities: new Set(),
    dealers: new Set(),
  };
}

function humanise(value: string): string {
  return value
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function byCountThenLabel(a: FacetOption, b: FacetOption): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

function withSelected(
  options: FacetOption[],
  selected: readonly string[] | undefined,
  label: (value: string) => string = humanise,
): FacetOption[] {
  const present = new Set(options.map((option) => option.value));
  const missing = (selected ?? [])
    .filter((value) => !present.has(value))
    .map((value) => ({ value, label: label(value), count: 0 }));
  return [...options, ...missing];
}

interface Tally {
  count: number;
  spellings: Map<string, number>;
  parent?: string;
}

function mostCommon(spellings: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

function tally(
  rows: readonly { key: string; spelling: string; count: number; parent?: string }[],
): FacetOption[] {
  const tallies = new Map<string, Tally>();
  for (const row of rows) {
    if (row.key === '') continue;
    const entry = tallies.get(row.key) ?? { count: 0, spellings: new Map<string, number>() };
    entry.count += row.count;
    entry.spellings.set(row.spelling, (entry.spellings.get(row.spelling) ?? 0) + row.count);
    if (row.parent !== undefined) entry.parent = row.parent;
    tallies.set(row.key, entry);
  }
  return [...tallies].map(([value, entry]) => ({
    value,
    label: mostCommon(entry.spellings),
    count: entry.count,
    ...(entry.parent === undefined ? {} : { parent: entry.parent }),
  }));
}

export function textFacet(
  rows: readonly Counted<string | null>[],
  selected: readonly string[] | undefined,
): FacetOption[] {
  const options = tally(
    rows.flatMap((row) =>
      row.value === null
        ? []
        : [{ key: slugify(row.value), spelling: row.value.trim(), count: row.count }],
    ),
  ).sort(byCountThenLabel);
  return withSelected(options, selected);
}

export function modelFacet(
  rows: readonly { make: string | null; model: string | null; count: number }[],
  selected: readonly string[] | undefined,
): FacetOption[] {
  const options = tally(
    rows.flatMap((row) =>
      row.model === null
        ? []
        : [
            {
              key: slugify(row.model),
              spelling: row.model.trim(),
              count: row.count,
              parent: slugOf(row.make),
            },
          ],
    ),
  ).sort(byCountThenLabel);
  return withSelected(options, selected);
}

function enumFacet<E extends string>(
  rows: readonly Counted<E | null>[],
  labels: Record<E, string>,
  selected: readonly string[] | undefined,
): FacetOption[] {
  const options = rows
    .flatMap((row) =>
      row.value === null
        ? []
        : [{ value: row.value.toLowerCase(), label: labels[row.value], count: row.count }],
    )
    .sort(byCountThenLabel);
  const labelOf = (value: string): string =>
    Object.entries<string>(labels).find(([key]) => key.toLowerCase() === value)?.[1] ??
    humanise(value);
  return withSelected(options, selected, labelOf);
}

export const fuelFacet = (
  rows: readonly Counted<FuelType | null>[],
  selected: readonly string[] | undefined,
): FacetOption[] => enumFacet(rows, FUEL_LABELS, selected);

export const transmissionFacet = (
  rows: readonly Counted<Transmission | null>[],
  selected: readonly string[] | undefined,
): FacetOption[] => enumFacet(rows, TRANSMISSION_LABELS, selected);

export const bodyTypeFacet = (
  rows: readonly Counted<BodyType | null>[],
  selected: readonly string[] | undefined,
): FacetOption[] => enumFacet(rows, BODY_TYPE_LABELS, selected);

export function colorFacet(rows: readonly Counted<VehicleColor | null>[]): FacetOption[] {
  const counts = new Map<VehicleColor, number>();
  for (const row of rows) if (row.value !== null) counts.set(row.value, row.count);
  return ColorEnum.options.map((color) => ({
    value: color.toLowerCase(),
    label: VEHICLE_COLOR_LABELS[color],
    count: counts.get(color) ?? 0,
  }));
}

const OWNER_BUCKETS: readonly OwnerBucket[] = ['1', '2', '3', '4'];

function bucketOf(owners: number): OwnerBucket | null {
  if (owners < 1) return null;
  return OWNER_BUCKETS[Math.min(owners, OWNER_BUCKET_MIN) - 1] ?? null;
}

export function ownerFacet(
  rows: readonly Counted<number | null>[],
  selected: readonly string[] | undefined,
): FacetOption[] {
  const counts = new Map<OwnerBucket, number>();
  for (const row of rows) {
    const bucket = row.value === null ? null : bucketOf(row.value);
    if (bucket) counts.set(bucket, (counts.get(bucket) ?? 0) + row.count);
  }
  const chosen = new Set(selected ?? []);
  return OWNER_BUCKETS.filter((bucket) => counts.has(bucket) || chosen.has(bucket)).map(
    (bucket) => ({
      value: bucket,
      label: OWNER_BUCKET_LABELS[bucket],
      count: counts.get(bucket) ?? 0,
    }),
  );
}

export function yearFacet(rows: readonly Counted<number | null>[]): FacetOption[] {
  return rows
    .flatMap((row) => (row.value === null ? [] : [row]))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((row) => ({ value: String(row.value), label: String(row.value), count: row.count }));
}

export function rangeFacets(
  presets: readonly RangePreset[],
  counts: readonly number[],
): RangeFacet[] {
  return presets.map((preset, index) => ({
    min: preset.min,
    max: preset.max,
    label: preset.label,
    count: counts[index] ?? 0,
  }));
}

export function cityFacet(
  perDealer: ReadonlyMap<string, number>,
  scope: LocationScope,
  selected: readonly string[] | undefined,
): FacetOption[] {
  const rows = scope.inScope.flatMap((dealer) => {
    const count = perDealer.get(dealer.id) ?? 0;
    const allowed = scope.dealers.size === 0 || scope.dealers.has(dealer.slug);
    return count > 0 && allowed && dealer.city
      ? [{ key: slugify(dealer.city), spelling: dealer.city, count }]
      : [];
  });
  return withSelected(tally(rows).sort(byCountThenLabel), selected);
}

export function dealerFacet(
  perDealer: ReadonlyMap<string, number>,
  scope: LocationScope,
  selected: readonly string[] | undefined,
): FacetOption[] {
  const options = scope.inScope
    .filter((dealer) => scope.cities.size === 0 || scope.cities.has(slugOf(dealer.city)))
    .flatMap((dealer) => {
      const count = perDealer.get(dealer.id) ?? 0;
      return count > 0 ? [{ value: dealer.slug, label: dealer.brandName, count }] : [];
    })
    .sort(byCountThenLabel);
  const names = new Map(scope.inScope.map((dealer) => [dealer.slug, dealer.brandName]));
  return withSelected(options, selected, (value) => names.get(value) ?? humanise(value));
}
