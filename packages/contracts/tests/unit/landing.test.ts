import { describe, expect, it } from 'vitest';

import {
  LANDING_MIN_CARS,
  LANDING_PRICE_LAKHS,
  LandingPagesQuery,
  PublicConfig,
  PublicLandingPagesResponse,
  VEHICLE_MAKES,
  brandLandingSlug,
  landingFacetLabel,
  modelLandingSlug,
  parseLandingFacet,
  priceLandingSlug,
} from '../../src/index.js';

describe('the landing threshold', () => {
  it('is two cars', () => {
    expect(LANDING_MIN_CARS).toBe(2);
  });
});

describe('parseLandingFacet', () => {
  it('reads every fixed facet as the search parameter it stands for', () => {
    expect(parseLandingFacet('diesel')).toEqual({
      kind: 'FUEL',
      slug: 'diesel',
      params: { fuel: 'diesel' },
    });
    expect(parseLandingFacet('suv')).toEqual({
      kind: 'BODY_TYPE',
      slug: 'suv',
      params: { bodyType: 'suv' },
    });
    expect(parseLandingFacet('automatic')).toEqual({
      kind: 'TRANSMISSION',
      slug: 'automatic',
      params: { transmission: 'automatic' },
    });
    expect(parseLandingFacet('under-5-lakh')).toEqual({
      kind: 'PRICE',
      slug: 'under-5-lakh',
      params: { maxPrice: '50000000' },
    });
  });

  it('reads a brand from the closed list, and a brand followed by a model', () => {
    expect(parseLandingFacet('maruti-suzuki')).toEqual({
      kind: 'BRAND',
      slug: 'maruti-suzuki',
      params: { brand: 'maruti-suzuki' },
    });
    expect(parseLandingFacet('maruti-suzuki-swift-dzire')).toEqual({
      kind: 'MODEL',
      slug: 'maruti-suzuki-swift-dzire',
      params: { brand: 'maruti-suzuki', model: 'swift-dzire' },
    });
  });

  it('prefers the longest brand, so a hyphenated brand is never read as a model', () => {
    expect(parseLandingFacet('land-rover-defender')?.params).toEqual({
      brand: 'land-rover',
      model: 'defender',
    });
    expect(parseLandingFacet('mercedes-benz')?.kind).toBe('BRAND');
  });

  it('names nothing for a segment outside the vocabulary', () => {
    for (const slug of [
      '',
      'cheap',
      'maruti',
      'under-6-lakh',
      'under-5-lakhs',
      'maruti-suzuki-',
      'maruti-suzuki--swift',
      'maruti-suzuki-Swift',
    ]) {
      expect(parseLandingFacet(slug)).toBeNull();
    }
  });

  it('reads back every slug it writes', () => {
    for (const make of VEHICLE_MAKES) {
      expect(parseLandingFacet(brandLandingSlug(make))?.kind).toBe('BRAND');
      expect(parseLandingFacet(modelLandingSlug(make, 'Grand i10 Nios'))).toMatchObject({
        kind: 'MODEL',
        params: { brand: brandLandingSlug(make), model: 'grand-i10-nios' },
      });
    }
    for (const lakhs of LANDING_PRICE_LAKHS) {
      expect(parseLandingFacet(priceLandingSlug(lakhs))?.kind).toBe('PRICE');
    }
  });
});

describe('landingFacetLabel', () => {
  function label(slug: string, model?: string) {
    const facet = parseLandingFacet(slug);
    if (!facet) throw new Error(`no facet: ${slug}`);
    return landingFacetLabel(facet, model);
  }

  it('names each facet the way a title says it', () => {
    expect(label('maruti-suzuki')).toBe('Maruti Suzuki');
    expect(label('mg')).toBe('MG');
    expect(label('diesel')).toBe('Diesel');
    expect(label('cng')).toBe('CNG');
    expect(label('suv')).toBe('SUV');
    expect(label('automatic')).toBe('Automatic');
    expect(label('under-5-lakh')).toBe('Under ₹5 lakh');
  });

  it('spells a model as dealers spell it when told, and title-cases its slug when not', () => {
    expect(label('hyundai-grand-i10', 'Grand i10')).toBe('Hyundai Grand i10');
    expect(label('hyundai-grand-i10')).toBe('Hyundai Grand I10');
    expect(label('hyundai-grand-i10', '  ')).toBe('Hyundai Grand I10');
  });
});

describe('the landing-pages read', () => {
  it('takes no parameters, and names any it is sent', () => {
    expect(LandingPagesQuery.safeParse({}).success).toBe(true);
    expect(LandingPagesQuery.safeParse({ district: 'vellore' }).success).toBe(false);
  });

  it('parses a response', () => {
    expect(
      PublicLandingPagesResponse.parse({
        minCars: 2,
        places: [
          {
            slug: 'arcot',
            name: 'Arcot',
            kind: 'TOWN',
            district: { slug: 'ranipet', name: 'Ranipet' },
            state: 'Tamil Nadu',
            cars: 6,
          },
        ],
        pages: [
          {
            place: 'arcot',
            facet: 'diesel',
            kind: 'FUEL',
            label: 'Diesel',
            cars: 2,
            lastModified: '2026-11-01T10:00:00.000Z',
          },
        ],
      }).pages,
    ).toHaveLength(1);
  });
});

describe('the landing-pages switch', () => {
  it('reads as off when an older API does not send it', () => {
    const parsed = PublicConfig.parse({
      mediaBaseUrl: '',
      captchaSiteKey: null,
      supportEmail: '',
      supportPhone: '',
      minPhotosPerListing: 6,
      listingDurationDays: 90,
      enquiryRateLimitPerHour: 5,
      photoRequestsEnabled: false,
      rcLookupEnabled: false,
      vehicleReportEnabled: false,
      social: [],
      support: {
        customer: { email: '', phone: '' },
        dealer: { email: '', phone: '' },
        whatsappHref: null,
      },
      heroImage: null,
    });
    expect(parsed.landingPagesEnabled).toBe(false);
  });
});
