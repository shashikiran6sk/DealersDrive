import type { VehicleSearchParams } from '@/lib/vehicle-search';

export interface DiscoverySection {
  key: string;
  title: string;
  params: VehicleSearchParams;
}

export const DISCOVERY_CARD_COUNT = 4;

export const DISCOVERY_SECTIONS: readonly DiscoverySection[] = [
  { key: 'recent', title: 'Recently added', params: {} },
  { key: 'suv', title: 'SUVs', params: { bodyType: 'suv' } },
  { key: 'automatic', title: 'Automatic cars', params: { transmission: 'automatic' } },
  { key: 'under-10-lakh', title: 'Under ₹10 lakh', params: { maxPrice: '100000000' } },
];

export const HOME_TEXT = {
  eyebrow: 'Independent dealers · one trusted platform',
  title: 'Find your next car',
  lede: 'Used cars from verified independent dealerships, photographed by Dealers-Drive and reviewed before they go live. Choose where, what and how much — the marketplace does the rest.',
  browseAll: 'Browse every car',
  browseDealers: 'Explore verified dealers',
  viewAll: 'View all →',
  discoveryLabel: 'Cars on Dealers-Drive now',
} as const;
