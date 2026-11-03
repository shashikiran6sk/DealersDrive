import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  LANDING_MIN_CARS,
  LANDING_PAGE_LIMIT,
  LANDING_PRICE_LAKHS,
  TRANSMISSION_LABELS,
  brandLandingSlug,
  canonicalDistrictFilterSlug,
  canonicalVehicleMake,
  landingPriceCeiling,
  modelLandingSlug,
  priceLandingSlug,
  slugify,
  type LandingFacetKind,
  type LandingPage,
  type LandingPlace,
  type PublicLandingPagesResponse,
} from '@dealers-drive/contracts';

import type { LandingDealerRow, LandingListingRow } from './search.repository.js';

interface Tally {
  counts: Map<string, number>;
}

function tally(): Tally {
  return { counts: new Map() };
}

function add(into: Tally, value: string | null | undefined): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  into.counts.set(trimmed, (into.counts.get(trimmed) ?? 0) + 1);
}

function mostCommon(from: Tally): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of from.counts) {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function districtSlugOf(name: string | null): string | null {
  const slug = name ? slugify(name) : '';
  return slug ? canonicalDistrictFilterSlug(slug) : null;
}

export function townSlugOf(name: string | null): string | null {
  const slug = name ? slugify(name) : '';
  return slug || null;
}

interface PlaceDraft {
  names: Tally;
  states: Tally;
  districts: Map<string, number>;
  statesByDistrict: Map<string, Tally>;
  cars: number;
}

function draft(): PlaceDraft {
  return {
    names: tally(),
    states: tally(),
    districts: new Map(),
    statesByDistrict: new Map(),
    cars: 0,
  };
}

function draftFor(drafts: Map<string, PlaceDraft>, slug: string): PlaceDraft {
  const existing = drafts.get(slug);
  if (existing) return existing;
  const made = draft();
  drafts.set(slug, made);
  return made;
}

export type TownResolution =
  | { kind: 'TOWN'; district: string }
  | { kind: 'DISTRICT'; district: string }
  | { kind: 'AMBIGUOUS' };

function majorityOf(counts: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [district, count] of counts) {
    if (count > bestCount) {
      best = district;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  return tied ? null : best;
}

export function resolveTown(
  town: string,
  dealersByDistrict: ReadonlyMap<string, number>,
  allDistricts: ReadonlySet<string>,
): TownResolution {
  const district = majorityOf(dealersByDistrict);
  if (district === null) return { kind: 'AMBIGUOUS' };
  const asDistrict = canonicalDistrictFilterSlug(town);
  if (asDistrict === district) return { kind: 'DISTRICT', district };
  if (allDistricts.has(asDistrict)) return { kind: 'AMBIGUOUS' };
  return { kind: 'TOWN', district };
}

interface PageDraft {
  place: string;
  facet: string | null;
  kind: LandingFacetKind | null;
  labels: Tally;
  cars: number;
  lastModified: number;
}

interface FacetHit {
  facet: string;
  kind: LandingFacetKind;
  label: string;
}

const FUEL_SLUGS = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  CNG: 'cng',
  ELECTRIC: 'electric',
  HYBRID: 'hybrid',
  LPG: 'lpg',
} as const;

const TRANSMISSION_SLUGS = { MANUAL: 'manual', AUTOMATIC: 'automatic' } as const;

const BODY_SLUGS = {
  HATCHBACK: 'hatchback',
  SEDAN: 'sedan',
  SUV: 'suv',
  MUV: 'muv',
  LUXURY: 'luxury',
} as const;

export function facetsOfListing(vehicle: LandingListingRow['vehicle']): FacetHit[] {
  const hits: FacetHit[] = [];
  const make = vehicle.make ? canonicalVehicleMake(vehicle.make) : null;
  if (make) {
    hits.push({ facet: brandLandingSlug(make), kind: 'BRAND', label: make });
    const model = vehicle.model?.trim();
    if (model && slugify(model)) {
      hits.push({
        facet: modelLandingSlug(make, model),
        kind: 'MODEL',
        label: `${make} ${model}`,
      });
    }
  }
  if (vehicle.fuelType) {
    hits.push({
      facet: FUEL_SLUGS[vehicle.fuelType],
      kind: 'FUEL',
      label: FUEL_LABELS[vehicle.fuelType],
    });
  }
  if (vehicle.bodyType) {
    hits.push({
      facet: BODY_SLUGS[vehicle.bodyType],
      kind: 'BODY_TYPE',
      label: BODY_TYPE_LABELS[vehicle.bodyType],
    });
  }
  if (vehicle.transmission) {
    hits.push({
      facet: TRANSMISSION_SLUGS[vehicle.transmission],
      kind: 'TRANSMISSION',
      label: TRANSMISSION_LABELS[vehicle.transmission],
    });
  }
  if (vehicle.pricePaise !== null) {
    for (const lakhs of LANDING_PRICE_LAKHS) {
      if (vehicle.pricePaise <= BigInt(landingPriceCeiling(lakhs))) {
        hits.push({
          facet: priceLandingSlug(lakhs),
          kind: 'PRICE',
          label: `Under ₹${lakhs} lakh`,
        });
      }
    }
  }
  return hits;
}

function changedAt(row: LandingListingRow): number {
  return Math.max(row.updatedAt.getTime(), row.vehicle.updatedAt.getTime());
}

function placeOrder(a: LandingPlace, b: LandingPlace): number {
  if (a.kind !== b.kind) return a.kind === 'DISTRICT' ? -1 : 1;
  return b.cars - a.cars || a.name.localeCompare(b.name);
}

function pageOrder(a: LandingPage, b: LandingPage): number {
  return (
    b.cars - a.cars ||
    a.place.localeCompare(b.place) ||
    (a.facet ?? '').localeCompare(b.facet ?? '')
  );
}

export function buildLandingPages(
  dealers: readonly LandingDealerRow[],
  listings: readonly LandingListingRow[],
): PublicLandingPagesResponse {
  const districts = new Map<string, PlaceDraft>();
  const towns = new Map<string, PlaceDraft>();

  for (const dealer of dealers) {
    const district = districtSlugOf(dealer.district);
    if (!district) continue;
    const districtDraft = draftFor(districts, district);
    add(districtDraft.names, dealer.district);
    add(districtDraft.states, dealer.state);

    const town = townSlugOf(dealer.city);
    if (!town) continue;
    const townDraft = draftFor(towns, town);
    add(townDraft.names, dealer.city);
    const statesHere = townDraft.statesByDistrict.get(district) ?? tally();
    add(statesHere, dealer.state);
    townDraft.statesByDistrict.set(district, statesHere);
    townDraft.districts.set(district, (townDraft.districts.get(district) ?? 0) + 1);
  }

  const districtSlugs = new Set(districts.keys());
  const townPlaces = new Map<string, string>();
  for (const [town, townDraft] of towns) {
    const resolution = resolveTown(town, townDraft.districts, districtSlugs);
    if (resolution.kind === 'TOWN') townPlaces.set(town, resolution.district);
  }

  const pages = new Map<string, PageDraft>();
  const count = (place: string, hit: FacetHit | null, at: number) => {
    const key = `${place}|${hit?.facet ?? ''}`;
    const existing = pages.get(key);
    const page = existing ?? {
      place,
      facet: hit?.facet ?? null,
      kind: hit?.kind ?? null,
      labels: tally(),
      cars: 0,
      lastModified: 0,
    };
    page.cars += 1;
    page.lastModified = Math.max(page.lastModified, at);
    if (hit) add(page.labels, hit.label);
    if (!existing) pages.set(key, page);
  };

  for (const row of listings) {
    const district = districtSlugOf(row.dealer.district);
    if (!district || !districts.has(district)) continue;
    const town = townSlugOf(row.dealer.city);
    const places = [district, ...(town && townPlaces.get(town) === district ? [town] : [])];
    const at = changedAt(row);
    const hits = facetsOfListing(row.vehicle);
    for (const place of places) {
      const placeDraft = place === district ? districts.get(district) : towns.get(place);
      if (placeDraft) placeDraft.cars += 1;
      count(place, null, at);
      for (const hit of hits) count(place, hit, at);
    }
  }

  const districtName = (slug: string): string =>
    mostCommon(districts.get(slug)?.names ?? tally()) ?? slug;

  const places: LandingPlace[] = [
    ...[...districts].map(([slug, place]) => ({
      slug,
      name: districtName(slug),
      kind: 'DISTRICT' as const,
      district: { slug, name: districtName(slug) },
      state: mostCommon(place.states),
      cars: place.cars,
    })),
    ...[...townPlaces].flatMap(([slug, district]) => {
      const place = towns.get(slug);
      if (!place) return [];
      return [
        {
          slug,
          name: mostCommon(place.names) ?? slug,
          kind: 'TOWN' as const,
          district: { slug: district, name: districtName(district) },
          state: mostCommon(place.statesByDistrict.get(district) ?? tally()),
          cars: place.cars,
        },
      ];
    }),
  ].sort(placeOrder);

  const built: LandingPage[] = [...pages.values()]
    .map((page) => ({
      place: page.place,
      facet: page.facet,
      kind: page.kind,
      label: page.kind ? mostCommon(page.labels) : null,
      cars: page.cars,
      lastModified: page.lastModified > 0 ? new Date(page.lastModified).toISOString() : null,
    }))
    .sort(pageOrder)
    .slice(0, LANDING_PAGE_LIMIT);

  return { minCars: LANDING_MIN_CARS, places, pages: built };
}
