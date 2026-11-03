import {
  LANDING_PRICE_LAKHS,
  LandingFacetKind,
  PublicLandingPagesResponse,
  brandLandingSlug,
  canonicalDistrictFilterSlug,
  canonicalVehicleMake,
  landingFacetLabel,
  landingPriceCeiling,
  modelLandingSlug,
  parseLandingFacet,
  priceLandingSlug,
  slugify,
  type PublicVehicleDetail,
  type LandingFacet,
  type LandingPage,
  type LandingPlace,
} from '@dealers-drive/contracts';
import { cache } from 'react';

import type { RelatedSearchGroup, RelatedSearchLink } from '@/types';

import { apiGetParsed } from './api';
import { DEALERS_TAG, VEHICLES_TAG } from './cache-tags';
import { isMissingResource } from './errors';
import { LANDING_TEXT, type LandingNaming } from './landing.constants';
import { logger } from './logger';
import { getPublicConfig } from './public-config';
import type { VehicleSearchParams } from './vehicle-search';

export const LANDING_BASE_PATH = '/used-cars';

export const RELATED_LINK_LIMIT = 24;

export const RELATED_PER_KIND = 8;

export const SIMILAR_LINK_LIMIT = 6;

export const POPULAR_LINK_LIMIT = 10;

export const BROWSE_PER_GROUP = 8;

export const BROWSE_PER_SEARCH = 2;

const KIND_ORDER: readonly LandingFacetKind[] = LandingFacetKind.options;

export function landingPath(place: string, facet?: string | null): string {
  return facet ? `${LANDING_BASE_PATH}/${place}/${facet}` : `${LANDING_BASE_PATH}/${place}`;
}

export function districtCarsPath(district: string): string {
  return `/cars?district=${encodeURIComponent(district)}`;
}

export const landingPagesEnabled = cache(
  async (): Promise<boolean> => (await getPublicConfig()).landingPagesEnabled,
);

export const getLandingPages = cache(async (): Promise<PublicLandingPagesResponse | null> => {
  try {
    return await apiGetParsed(PublicLandingPagesResponse, '/v1/landing-pages', {
      revalidate: 300,
      tags: [VEHICLES_TAG, DEALERS_TAG],
    });
  } catch (error) {
    if (isMissingResource(error)) return null;
    throw error;
  }
});

export function isIndexableLanding(
  map: PublicLandingPagesResponse,
  page: Pick<LandingPage, 'cars'>,
): boolean {
  return page.cars >= map.minCars;
}

export function findLandingPage(
  map: PublicLandingPagesResponse,
  place: string,
  facet: string | null,
): LandingPage | undefined {
  return map.pages.find((page) => page.place === place && page.facet === facet);
}

export type LandingRoute =
  | { kind: 'not-found' }
  | { kind: 'redirect'; to: string }
  | {
      kind: 'page';
      place: LandingPlace;
      facet: LandingFacet | null;
      label: string | null;
      entry: LandingPage | undefined;
    };

export function resolveLanding(
  map: PublicLandingPagesResponse,
  segments: readonly string[],
): LandingRoute {
  const [placeSlug, facetSlug, ...rest] = segments;
  if (placeSlug === undefined || rest.length > 0) return { kind: 'not-found' };

  const place = map.places.find((candidate) => candidate.slug === placeSlug);
  if (!place) return { kind: 'not-found' };

  if (facetSlug === undefined) {
    if (place.kind === 'DISTRICT') return { kind: 'redirect', to: districtCarsPath(place.slug) };
    return {
      kind: 'page',
      place,
      facet: null,
      label: null,
      entry: findLandingPage(map, place.slug, null),
    };
  }

  const facet = parseLandingFacet(facetSlug);
  if (!facet) return { kind: 'not-found' };
  const entry = findLandingPage(map, place.slug, facet.slug);
  if (facet.kind === 'MODEL' && !entry) return { kind: 'not-found' };

  return { kind: 'page', place, facet, label: entry?.label ?? landingFacetLabel(facet), entry };
}

export function landingSearch(
  place: LandingPlace,
  facet: LandingFacet | null,
): VehicleSearchParams {
  return {
    district: place.district.slug,
    ...(place.kind === 'TOWN' ? { city: place.slug } : {}),
    ...(facet?.params ?? {}),
  };
}

function namingOf(page: LandingPage, place: LandingPlace): LandingNaming {
  return { kind: page.kind, label: page.label, place: place.name };
}

function priceCeilingOf(page: LandingPage): number {
  return Number(parseLandingFacet(page.facet ?? '')?.params.maxPrice ?? 0);
}

function byKindThenCars(a: LandingPage, b: LandingPage): number {
  const kind = KIND_ORDER.indexOf(a.kind ?? 'BRAND') - KIND_ORDER.indexOf(b.kind ?? 'BRAND');
  if (kind) return kind;
  if (a.kind === 'PRICE') return priceCeilingOf(a) - priceCeilingOf(b);
  return b.cars - a.cars || (a.facet ?? '').localeCompare(b.facet ?? '');
}

export function relatedLandingGroups(
  map: PublicLandingPagesResponse,
  place: LandingPlace,
  current: string | null,
): RelatedSearchGroup[] {
  const searches: RelatedSearchLink[] = map.pages
    .filter(
      (page) =>
        page.place === place.slug &&
        page.facet !== null &&
        page.facet !== current &&
        isIndexableLanding(map, page),
    )
    .sort(byKindThenCars)
    .filter(
      (page, index, sorted) =>
        sorted.slice(0, index).filter((earlier) => earlier.kind === page.kind).length <
        RELATED_PER_KIND,
    )
    .map((page) => ({
      href: landingPath(place.slug, page.facet),
      label: LANDING_TEXT.name(namingOf(page, place)),
    }));

  const district = map.places.find(
    (candidate) => candidate.kind === 'DISTRICT' && candidate.slug === place.district.slug,
  );
  const towns: RelatedSearchLink[] = map.places
    .filter(
      (candidate) =>
        candidate.kind === 'TOWN' &&
        candidate.district.slug === place.district.slug &&
        candidate.slug !== place.slug,
    )
    .flatMap((town) => {
      const page = findLandingPage(map, town.slug, current);
      if (!page || !isIndexableLanding(map, page)) return [];
      return [
        { href: landingPath(town.slug, current), label: LANDING_TEXT.name(namingOf(page, town)) },
      ];
    })
    .slice(0, RELATED_LINK_LIMIT);

  const wholeDistrict: RelatedSearchLink[] = [];
  if (place.kind === 'TOWN' && district) {
    const page = findLandingPage(map, district.slug, current);
    if (current === null) {
      wholeDistrict.push({
        href: districtCarsPath(district.slug),
        label: LANDING_TEXT.wholeDistrict(district.name),
      });
    } else if (page && isIndexableLanding(map, page)) {
      wholeDistrict.push({
        href: landingPath(district.slug, current),
        label: LANDING_TEXT.name(namingOf(page, district)),
      });
    }
  }

  return [
    { title: LANDING_TEXT.searchesIn(place.name), links: searches },
    { title: LANDING_TEXT.townsIn(place.district.name), links: [...wholeDistrict, ...towns] },
  ];
}

export interface RelatedSearchesBlock {
  heading: string;
  groups: RelatedSearchGroup[];
}

async function withLandingPages<T>(
  event: string,
  build: (map: PublicLandingPagesResponse) => T | null,
): Promise<T | null> {
  try {
    if (!(await landingPagesEnabled())) return null;
    const map = await getLandingPages();
    return map ? build(map) : null;
  } catch (error) {
    logger.warn(event, { error });
    return null;
  }
}

export function districtRelatedSearches(district: string): Promise<RelatedSearchesBlock | null> {
  return withLandingPages('landing.related_unavailable', (map) => {
    const slug = canonicalDistrictFilterSlug(district);
    const place = map.places.find(
      (candidate) => candidate.kind === 'DISTRICT' && candidate.slug === slug,
    );
    if (!place) return null;
    return {
      heading: LANDING_TEXT.related(place.name),
      groups: relatedLandingGroups(map, place, null),
    };
  });
}

function byCars(a: LandingPage, b: LandingPage): number {
  return (
    b.cars - a.cars ||
    a.place.localeCompare(b.place) ||
    (a.facet ?? '').localeCompare(b.facet ?? '')
  );
}

function placesOf(map: PublicLandingPagesResponse): Map<string, LandingPlace> {
  return new Map(map.places.map((place) => [place.slug, place]));
}

function linkTo(page: LandingPage, place: LandingPlace): RelatedSearchLink {
  if (page.facet === null && place.kind === 'DISTRICT') {
    return { href: districtCarsPath(place.slug), label: LANDING_TEXT.name(namingOf(page, place)) };
  }
  return {
    href: landingPath(place.slug, page.facet),
    label: LANDING_TEXT.name(namingOf(page, place)),
  };
}

function facetSlugOf(label: string | null, kind: LandingFacetKind): string | null {
  if (!label) return null;
  const facet = parseLandingFacet(slugify(label));
  return facet?.kind === kind ? facet.slug : null;
}

export function vehicleFacetSlugs(vehicle: PublicVehicleDetail): string[] {
  const { facts } = vehicle;
  const make = facts.make ? canonicalVehicleMake(facts.make) : null;
  const price = facts.pricePaise;
  const lakhs =
    price === null
      ? undefined
      : LANDING_PRICE_LAKHS.find((value) => price <= landingPriceCeiling(value));
  return [
    make && facts.model?.trim() ? modelLandingSlug(make, facts.model) : null,
    make ? brandLandingSlug(make) : null,
    facetSlugOf(facts.bodyType, 'BODY_TYPE'),
    facetSlugOf(facts.fuelType, 'FUEL'),
    facetSlugOf(facts.transmission, 'TRANSMISSION'),
    lakhs === undefined ? null : priceLandingSlug(lakhs),
  ].filter((slug): slug is string => slug !== null);
}

export function vehicleLandingGroups(
  map: PublicLandingPagesResponse,
  vehicle: PublicVehicleDetail,
): RelatedSearchGroup[] {
  const districtSlug = vehicle.dealer.district
    ? canonicalDistrictFilterSlug(slugify(vehicle.dealer.district))
    : null;
  const townSlug = vehicle.dealer.city ? slugify(vehicle.dealer.city) : null;
  const district = map.places.find(
    (place) => place.kind === 'DISTRICT' && place.slug === districtSlug,
  );
  const town = map.places.find(
    (place) =>
      place.kind === 'TOWN' && place.slug === townSlug && place.district.slug === districtSlug,
  );
  const facets = vehicleFacetSlugs(vehicle);

  const linksIn = (place: LandingPlace | undefined): RelatedSearchLink[] =>
    place
      ? facets
          .map((facet) => findLandingPage(map, place.slug, facet))
          .filter(
            (page): page is LandingPage => page !== undefined && isIndexableLanding(map, page),
          )
          .slice(0, SIMILAR_LINK_LIMIT)
          .map((page) => linkTo(page, place))
      : [];

  return [
    ...(town ? [{ title: LANDING_TEXT.similarIn(town.name), links: linksIn(town) }] : []),
    ...(district
      ? [{ title: LANDING_TEXT.similarAcross(district.name), links: linksIn(district) }]
      : []),
  ];
}

export function vehicleRelatedSearches(
  vehicle: PublicVehicleDetail,
): Promise<RelatedSearchesBlock | null> {
  return withLandingPages('landing.vehicle_links_unavailable', (map) => ({
    heading: LANDING_TEXT.similarHeading,
    groups: vehicleLandingGroups(map, vehicle),
  }));
}

type Bucket = LandingFacetKind | 'DISTRICT' | 'TOWN';

const POPULAR_ORDER: readonly Bucket[] = [
  'DISTRICT',
  'BRAND',
  'TOWN',
  'BODY_TYPE',
  'PRICE',
  'FUEL',
  'MODEL',
  'TRANSMISSION',
];

interface Placed {
  page: LandingPage;
  place: LandingPlace;
}

function bucketsOf(map: PublicLandingPagesResponse): Map<Bucket, Placed[]> {
  const places = placesOf(map);
  const buckets = new Map<Bucket, Placed[]>();
  for (const page of [...map.pages].sort(byCars)) {
    const place = places.get(page.place);
    if (!place || !isIndexableLanding(map, page)) continue;
    const bucket: Bucket = page.kind ?? place.kind;
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), { page, place }]);
  }
  return buckets;
}

function varied(entries: readonly Placed[], limit: number): RelatedSearchLink[] {
  const seen = new Map<string, number>();
  const picked: RelatedSearchLink[] = [];
  for (const { page, place } of entries) {
    const key = page.facet ?? place.kind;
    const count = seen.get(key) ?? 0;
    if (page.facet !== null && count >= BROWSE_PER_SEARCH) continue;
    seen.set(key, count + 1);
    picked.push(linkTo(page, place));
    if (picked.length === limit) break;
  }
  return picked;
}

export function popularLandingLinks(
  map: PublicLandingPagesResponse,
  limit = POPULAR_LINK_LIMIT,
): RelatedSearchLink[] {
  const buckets = bucketsOf(map);
  const picked: RelatedSearchLink[] = [];
  for (let round = 0; picked.length < limit; round += 1) {
    const before = picked.length;
    for (const bucket of POPULAR_ORDER) {
      const entry = buckets.get(bucket)?.[round];
      if (entry && picked.length < limit) picked.push(linkTo(entry.page, entry.place));
    }
    if (picked.length === before) break;
  }
  return picked;
}

export function popularSearches(): Promise<RelatedSearchLink[] | null> {
  return withLandingPages('landing.popular_unavailable', (map) => popularLandingLinks(map));
}

export function browseLandingGroups(map: PublicLandingPagesResponse): RelatedSearchGroup[] {
  const buckets = bucketsOf(map);
  const top = (...kinds: Bucket[]) =>
    varied(
      kinds.flatMap((kind) => buckets.get(kind) ?? []).sort((a, b) => byCars(a.page, b.page)),
      BROWSE_PER_GROUP,
    );
  return [
    {
      title: LANDING_TEXT.byPlace,
      links: [
        ...varied(buckets.get('DISTRICT') ?? [], BROWSE_PER_GROUP / 2),
        ...varied(buckets.get('TOWN') ?? [], BROWSE_PER_GROUP / 2),
      ],
    },
    { title: LANDING_TEXT.byBrand, links: top('BRAND') },
    { title: LANDING_TEXT.byBudget, links: top('PRICE') },
    { title: LANDING_TEXT.byBody, links: top('BODY_TYPE') },
    { title: LANDING_TEXT.byFuelAndGearbox, links: top('FUEL', 'TRANSMISSION') },
  ];
}

export function browseSearches(): Promise<RelatedSearchesBlock | null> {
  return withLandingPages('landing.browse_unavailable', (map) => ({
    heading: LANDING_TEXT.browseHeading,
    groups: browseLandingGroups(map),
  }));
}
