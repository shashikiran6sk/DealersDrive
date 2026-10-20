import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';

export interface DiscoverySection {
  key: string;
  title: string;
  params: VehicleSearchParams;
}

export const DISCOVERY_CARD_COUNT = 4;

export const HOME_SEARCH_PATH = '/cars';

export const DISCOVERY_SECTIONS: readonly DiscoverySection[] = [
  { key: 'recent', title: 'Recently added', params: {} },
  { key: 'suv', title: 'SUVs', params: { bodyType: 'suv' } },
  { key: 'automatic', title: 'Automatic cars', params: { transmission: 'automatic' } },
  { key: 'under-10-lakh', title: 'Under ₹10 lakh', params: { maxPrice: '100000000' } },
];

export const HOME_TEXT = {
  eyebrow: 'Independent dealers · one trusted platform',
  title: 'Find your next car',
  lede: 'Used cars from independent dealerships, photographed by Dealers-Drive and reviewed before they go live. Choose where, what and how much — the marketplace does the rest.',
  browseAll: 'Browse every car',
  noCars: 'No available cars are listed in this selection right now.',
  browseDealers: 'Explore dealers',
  viewAll: 'View all →',
  discoveryLabel: 'Cars on Dealers-Drive now',
  unavailableTitle: 'We couldn’t load these vehicles right now',
  unavailableMessage: 'Please try again, or browse every car on the marketplace.',
} as const;

export type HomeInfoSection = 'journey' | 'trust' | 'audience';

export type HomeFlowItem =
  { kind: 'cars'; key: DiscoverySection['key'] } | { kind: 'info'; key: HomeInfoSection };

export const HOME_FLOW: readonly HomeFlowItem[] = [
  { kind: 'cars', key: 'recent' },
  { kind: 'info', key: 'journey' },
  { kind: 'cars', key: 'suv' },
  { kind: 'info', key: 'trust' },
  { kind: 'cars', key: 'automatic' },
  { kind: 'info', key: 'audience' },
  { kind: 'cars', key: 'under-10-lakh' },
];

export function discoveryRowId(key: string): string {
  return `home-${key}`;
}

export const JOURNEY_STEPS = [
  {
    number: '01',
    title: 'Find a trusted dealership',
    body: 'Explore our live directory of independent dealers whose identity and business have been checked.',
  },
  {
    number: '02',
    title: 'Discover the right car',
    body: 'Search cars Dealers-Drive has photographed and reviewed by make, model or variant.',
  },
  {
    number: '03',
    title: 'Speak directly to the dealer',
    body: 'Ask questions, arrange a visit and continue the purchase directly with the dealership.',
  },
] as const;

export const JOURNEY_TEXT = {
  eyebrow: 'Your journey',
  title: 'From local discovery to a real conversation',
  body: 'Dealers-Drive is designed to help buyers make an informed shortlist while keeping the dealership at the centre of every sale.',
} as const;

export const TRUST_POINTS = [
  {
    number: '01',
    title: 'Dealer verification',
    body: 'The Dealer Verified badge follows a review of business and representative evidence. Yard ownership is not a verification requirement.',
  },
  {
    number: '02',
    title: 'Reviewed vehicle listings',
    body: 'Listings are reviewed for clear photos, useful details and straightforward pricing before publication.',
  },
  {
    number: '03',
    title: 'Direct conversations',
    body: 'Your enquiry goes directly to the dealership advertising the vehicle. Confirm the vehicle’s documents and condition with them.',
  },
  {
    number: '04',
    title: 'Dealer-set prices',
    body: 'The price you see is set by the dealer. Dealers-Drive does not add a marketplace markup.',
  },
  {
    number: '05',
    title: 'Your number, proved once',
    body: 'Browse without an account. When you enquire, you sign in with your mobile number, so the dealer knows the lead is real.',
  },
] as const;

export const TRUST_TEXT = {
  eyebrow: 'Why Dealers-Drive',
  title: 'Confidence without getting in the way',
} as const;

export const HERO_ALT = 'A salesperson talking with a family beside SUVs in a car showroom';

export const BUYER_INFO = Object.freeze({
  eyebrow: 'Built for both sides',
  title: 'A marketplace where the dealer stays the dealer',
  body: 'Dealers-Drive helps buyers discover trustworthy local businesses and gives independent dealerships a professional place to present who they are.',
  buyerTitle: 'Know who you are buying from',
  buyerBody:
    'Start with dealer profiles and cars reviewed before they go live, then enquire about a car directly with the dealership advertising it.',
  link: 'Browse the dealer directory →',
});
