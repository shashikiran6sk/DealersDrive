import {
  LandingFacetKind,
  PublicLandingPagesResponse,
  canonicalDistrictFilterSlug,
  landingFacetLabel,
  parseLandingFacet,
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

export interface DistrictRelated {
  heading: string;
  groups: RelatedSearchGroup[];
}

export async function districtRelatedSearches(district: string): Promise<DistrictRelated | null> {
  try {
    if (!(await landingPagesEnabled())) return null;
    const map = await getLandingPages();
    const slug = canonicalDistrictFilterSlug(district);
    const place = map?.places.find(
      (candidate) => candidate.kind === 'DISTRICT' && candidate.slug === slug,
    );
    if (!map || !place) return null;
    return {
      heading: LANDING_TEXT.related(place.name),
      groups: relatedLandingGroups(map, place, null),
    };
  } catch (error) {
    logger.warn('landing.related_unavailable', { district, error });
    return null;
  }
}
