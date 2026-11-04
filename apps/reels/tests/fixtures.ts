import type { DealerPublicProfile, VehicleCardDto } from '@dealers-drive/contracts';

export function card(overrides: Partial<VehicleCardDto> = {}): VehicleCardDto {
  const slug = overrides.slug ?? 'car';
  return {
    slug,
    availability: 'AVAILABLE',
    title: '2022 Tata Nexon XZA+ S',
    year: 2022,
    priceLabel: '₹7,49,999',
    metaLabel: '93,304 km · Petrol · Automatic · Vellore',
    image: {
      url: `https://api.dealers-drive.com/media/by-media/${slug.padEnd(8, '0')}-aaaa-bbbb/640.webp`,
      alt: slug,
    },
    imageCount: 10,
    dealer: { name: 'Sample Motors', slug: 'sample-motors', initials: 'SM', isVerified: false },
    ...overrides,
  };
}

export function profile(overrides: Partial<DealerPublicProfile> = {}): DealerPublicProfile {
  return {
    slug: 'sample-motors-vellore-tamil-nadu',
    brandName: 'Sample Motors',
    legalName: 'Sample Motors',
    initials: 'SM',
    isVerified: false,
    tagline: null,
    services: ['Buying', 'Loan', 'Rc Transfer'],
    address: {
      line: null,
      city: 'Vellore',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: null,
      full: 'Vellore, Tamil Nadu',
      mapsUrl: null,
      geo: null,
      embedUrl: null,
    },
    stats: [],
    contact: [],
    logoUrl: null,
    coverUrl: null,
    portfolio: [],
    seo: {
      canonical: 'https://www.dealers-drive.com/dealers/sample-motors-vellore-tamil-nadu',
      title: 'Sample Motors',
      isIndexable: true,
    },
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
