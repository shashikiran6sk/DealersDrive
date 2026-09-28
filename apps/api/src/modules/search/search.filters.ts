import {
  OWNER_BUCKET_MIN,
  slugify,
  type BodyTypeSlug,
  type ColorSlug,
  type DealerVehicleQuery,
  type FuelSlug,
  type PublicVehicleQuery,
  type TransmissionSlug,
  type VehicleSort,
} from '@dealers-drive/contracts';
import type { BodyType, FuelType, Prisma, Transmission, VehicleColor } from '@prisma/client';

import { publicListingWhere, type PublicListingRule } from './search.repository.js';

export type FilterKey =
  | 'brand'
  | 'model'
  | 'price'
  | 'year'
  | 'km'
  | 'fuel'
  | 'transmission'
  | 'bodyType'
  | 'color'
  | 'owners';

export interface Bounds {
  min?: number;
  max?: number;
}

export interface Vocabulary {
  makes: readonly string[];
  models: readonly { make: string | null; model: string | null }[];
}

export interface ResolvedFilters {
  words: string[];
  makes?: string[];
  models?: string[];
  colors?: VehicleColor[];
  price: Bounds;
  year: Bounds;
  km: Bounds;
  fuel?: FuelType[];
  transmission?: Transmission[];
  bodyType?: BodyType[];
  owners?: number[];
}

export type VehicleFilterQuery = DealerVehicleQuery | PublicVehicleQuery;

const MAX_WORDS = 6;

const FUEL: Record<FuelSlug, FuelType> = {
  petrol: 'PETROL',
  diesel: 'DIESEL',
  cng: 'CNG',
  electric: 'ELECTRIC',
  hybrid: 'HYBRID',
  lpg: 'LPG',
};

const TRANSMISSION: Record<TransmissionSlug, Transmission> = {
  manual: 'MANUAL',
  automatic: 'AUTOMATIC',
};

const COLOR: Record<ColorSlug, VehicleColor> = {
  black: 'BLACK',
  white: 'WHITE',
  grey: 'GREY',
  silver: 'SILVER',
  red: 'RED',
  blue: 'BLUE',
  green: 'GREEN',
  brown: 'BROWN',
  beige: 'BEIGE',
  yellow: 'YELLOW',
  orange: 'ORANGE',
  other: 'OTHER',
};

const BODY: Record<BodyTypeSlug, BodyType> = {
  hatchback: 'HATCHBACK',
  sedan: 'SEDAN',
  suv: 'SUV',
  muv: 'MUV',
  luxury: 'LUXURY',
};

export function wordsOf(q: string | undefined): string[] {
  return (q ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_WORDS);
}

function spellingsOf(values: readonly (string | null)[], slugs: readonly string[]): string[] {
  const wanted = new Set(slugs);
  const found = new Set<string>();
  for (const value of values) {
    if (value !== null && wanted.has(slugify(value))) found.add(value);
  }
  return [...found];
}

export function needsVocabulary(query: VehicleFilterQuery): boolean {
  return Boolean(query.brand ?? query.model);
}

export function resolveFilters(
  query: VehicleFilterQuery,
  vocabulary: Vocabulary | null,
): ResolvedFilters {
  const models = vocabulary?.models ?? [];

  return {
    words: wordsOf(query.q),
    ...(query.brand ? { makes: spellingsOf(vocabulary?.makes ?? [], query.brand) } : {}),
    ...(query.model
      ? {
          models: spellingsOf(
            models.map((row) => row.model),
            query.model,
          ),
        }
      : {}),
    ...(query.color ? { colors: query.color.map((value) => COLOR[value]) } : {}),
    price: bounds(query.minPrice, query.maxPrice),
    year: bounds(query.minYear, query.maxYear),
    km: bounds(query.minKm, query.maxKm),
    ...(query.fuel ? { fuel: query.fuel.map((value) => FUEL[value]) } : {}),
    ...(query.transmission
      ? { transmission: query.transmission.map((value) => TRANSMISSION[value]) }
      : {}),
    ...(query.bodyType ? { bodyType: query.bodyType.map((value) => BODY[value]) } : {}),
    ...(query.owners ? { owners: query.owners.map(Number) } : {}),
  };
}

function bounds(min: number | undefined, max: number | undefined): Bounds {
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}

function range(value: Bounds): { gte?: number; lte?: number } | null {
  if (value.min === undefined && value.max === undefined) return null;
  return {
    ...(value.min === undefined ? {} : { gte: value.min }),
    ...(value.max === undefined ? {} : { lte: value.max }),
  };
}

function wordMatch(word: string): Prisma.VehicleWhereInput {
  const contains = { contains: word, mode: 'insensitive' as const };
  return {
    OR: [
      { make: contains },
      { model: contains },
      { variant: contains },
      { dealer: { brandName: contains } },
    ],
  };
}

function ownersMatch(owners: readonly number[]): Prisma.VehicleWhereInput {
  const exact = owners.filter((owner) => owner < OWNER_BUCKET_MIN);
  const open = owners.some((owner) => owner >= OWNER_BUCKET_MIN);
  return {
    OR: [
      ...(exact.length > 0 ? [{ ownerCount: { in: exact } }] : []),
      ...(open ? [{ ownerCount: { gte: OWNER_BUCKET_MIN } }] : []),
    ],
  };
}

export function vehicleWhere(
  filters: ResolvedFilters,
  omit: readonly FilterKey[] = [],
): Prisma.VehicleWhereInput {
  const skip = new Set(omit);
  const and: Prisma.VehicleWhereInput[] = filters.words.map(wordMatch);

  if (filters.makes && !skip.has('brand')) and.push({ make: { in: filters.makes } });
  if (filters.models && !skip.has('model')) and.push({ model: { in: filters.models } });
  if (filters.colors && !skip.has('color')) and.push({ color: { in: filters.colors } });

  const price = skip.has('price') ? null : range(filters.price);
  if (price) and.push({ pricePaise: price });
  const year = skip.has('year') ? null : range(filters.year);
  if (year) and.push({ manufacturingYear: year });
  const km = skip.has('km') ? null : range(filters.km);
  if (km) and.push({ kilometersDriven: km });

  if (filters.fuel && !skip.has('fuel')) and.push({ fuelType: { in: filters.fuel } });
  if (filters.transmission && !skip.has('transmission')) {
    and.push({ transmission: { in: filters.transmission } });
  }
  if (filters.bodyType && !skip.has('bodyType')) {
    and.push({ bodyType: { in: filters.bodyType } });
  }
  if (filters.owners && !skip.has('owners')) and.push(ownersMatch(filters.owners));

  return and.length > 0 ? { AND: and } : {};
}

export function listingWhere(
  dealerIds: readonly string[] | null,
  rule: PublicListingRule = 'available',
): Prisma.ListingWhereInput {
  const base = publicListingWhere(rule);
  return dealerIds === null ? base : { ...base, dealerId: { in: [...dealerIds] } };
}

export function inventoryWhere(
  filters: ResolvedFilters,
  dealerIds: readonly string[] | null,
  omit: readonly FilterKey[] = [],
): Prisma.VehicleWhereInput {
  return { ...vehicleWhere(filters, omit), listing: { is: listingWhere(dealerIds) } };
}

const NEWEST: Prisma.ListingOrderByWithRelationInput[] = [{ publishedAt: 'desc' }, { id: 'desc' }];

const AVAILABLE_FIRST: Prisma.ListingOrderByWithRelationInput = { status: 'asc' };

export function orderOf(sort: VehicleSort): Prisma.ListingOrderByWithRelationInput[] {
  return [AVAILABLE_FIRST, ...sortOf(sort)];
}

function sortOf(sort: VehicleSort): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ vehicle: { pricePaise: { sort: 'asc', nulls: 'last' } } }, ...NEWEST];
    case 'price_desc':
      return [{ vehicle: { pricePaise: { sort: 'desc', nulls: 'last' } } }, ...NEWEST];
    case 'year_desc':
      return [{ vehicle: { manufacturingYear: { sort: 'desc', nulls: 'last' } } }, ...NEWEST];
    case 'km_asc':
      return [{ vehicle: { kilometersDriven: { sort: 'asc', nulls: 'last' } } }, ...NEWEST];
    case 'newest':
      return NEWEST;
  }
}
