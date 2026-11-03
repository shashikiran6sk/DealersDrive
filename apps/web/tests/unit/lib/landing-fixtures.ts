import type {
  LandingPage,
  LandingPlace,
  PublicLandingPagesResponse,
} from '@dealers-drive/contracts';

const AT = '2026-11-01T10:00:00.000Z';
const STATE = 'Tamil Nadu';

function district(slug: string, name: string, cars: number): LandingPlace {
  return { slug, name, kind: 'DISTRICT', district: { slug, name }, state: STATE, cars };
}

function town(slug: string, name: string, cars: number): LandingPlace {
  return {
    slug,
    name,
    kind: 'TOWN',
    district: { slug: 'ranipet', name: 'Ranipet' },
    state: STATE,
    cars,
  };
}

function page(
  place: string,
  facet: string | null,
  kind: LandingPage['kind'],
  label: string | null,
  cars: number,
): LandingPage {
  return { place, facet, kind, label, cars, lastModified: AT };
}

export const LANDING_AT = AT;

export const LANDING_MAP: PublicLandingPagesResponse = {
  minCars: 2,
  places: [
    district('vellore', 'Vellore', 24),
    district('ranipet', 'Ranipet', 8),
    town('arcot', 'Arcot', 6),
    town('walajapet', 'Walajapet', 2),
  ],
  pages: [
    page('vellore', null, null, null, 24),
    page('vellore', 'maruti-suzuki', 'BRAND', 'Maruti Suzuki', 5),
    page('ranipet', null, null, null, 8),
    page('ranipet', 'diesel', 'FUEL', 'Diesel', 4),
    page('arcot', null, null, null, 6),
    page('arcot', 'maruti-suzuki', 'BRAND', 'Maruti Suzuki', 3),
    page('arcot', 'under-5-lakh', 'PRICE', 'Under ₹5 lakh', 2),
    page('arcot', 'diesel', 'FUEL', 'Diesel', 2),
    page('arcot', 'maruti-suzuki-swift', 'MODEL', 'Maruti Suzuki Swift', 2),
    page('arcot', 'hyundai-creta', 'MODEL', 'Hyundai Creta', 1),
    page('walajapet', null, null, null, 2),
    page('walajapet', 'diesel', 'FUEL', 'Diesel', 2),
  ],
};
