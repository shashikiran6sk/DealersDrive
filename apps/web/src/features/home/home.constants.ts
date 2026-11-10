import type { VehicleSearchParams } from '@/lib/vehicle-search';

export type HomeCategoryKey = 'suv' | 'automatic' | 'under-10-lakh' | 'family' | 'low-km';

export type HomeCategoryIcon = 'suv' | 'automatic' | 'price' | 'family' | 'odometer';

export interface HomeCategoryFact {
  label: string;
  value: string;
}

export interface HomeCategory {
  key: HomeCategoryKey;
  title: string;
  shortLabel: string;
  icon: HomeCategoryIcon;
  params: VehicleSearchParams;
  description: string;
  facts: readonly HomeCategoryFact[];
  browseLabel: string;
  emptyMessage: string;
  featured: boolean;
}

export const RECENT_CAR_COUNT = 10;

export const RECENT_ROW_COUNT = 4;

export const CATEGORY_CAR_COUNT = 3;

export const HOME_SEARCH_PATH = '/cars';

export const HOME_CATEGORIES: readonly HomeCategory[] = [
  {
    key: 'suv',
    title: 'SUVs',
    shortLabel: 'SUVs',
    icon: 'suv',
    params: { bodyType: 'suv' },
    description:
      'A higher seat and more ground clearance. Handles broken roads and monsoon water, and lets you see over the traffic.',
    facts: [
      { label: 'Seats', value: '5 to 7' },
      { label: 'Best for', value: 'Mixed roads, rainy season' },
      { label: 'Look for', value: 'Underbody condition, tyre wear' },
    ],
    browseLabel: 'Browse SUVs',
    emptyMessage: 'No SUVs are listed right now. New cars go live as dealers add them.',
    featured: false,
  },
  {
    key: 'automatic',
    title: 'Automatic',
    shortLabel: 'Automatic',
    icon: 'automatic',
    params: { transmission: 'automatic' },
    description:
      'No clutch in stop-start traffic. Easier on your left leg in the city, and easier to learn on if you are a new driver.',
    facts: [
      { label: 'Best for', value: 'City traffic, new drivers' },
      { label: 'Types', value: 'AMT, CVT, torque converter' },
      { label: 'Look for', value: 'Smooth shifts on a test drive' },
    ],
    browseLabel: 'Browse automatic cars',
    emptyMessage: 'No automatic cars are listed right now. New cars go live as dealers add them.',
    featured: false,
  },
  {
    key: 'under-10-lakh',
    title: 'Under ₹10 lakh',
    shortLabel: 'Under ₹10L',
    icon: 'price',
    params: { maxPrice: '100000000', sort: 'price_asc' },
    description:
      'Where most buyers shop. Hatchbacks, sedans and compact SUVs, each priced by the dealer with no marketplace markup.',
    facts: [
      { label: 'Price', value: 'Up to ₹10,00,000' },
      { label: 'Includes', value: 'Every body type' },
      { label: 'Ask', value: 'What the price includes' },
    ],
    browseLabel: 'Browse cars under ₹10 lakh',
    emptyMessage:
      'No cars under ₹10 lakh are listed right now. New cars go live as dealers add them.',
    featured: false,
  },
  {
    key: 'family',
    title: 'Family cars',
    shortLabel: 'Family cars',
    icon: 'family',
    params: { bodyType: 'muv' },
    description:
      'Three rows in one car. Seven or eight seats for the whole family, the temple trip and everyone’s luggage.',
    facts: [
      { label: 'Seats', value: '7 to 8' },
      { label: 'Best for', value: 'Large families, group travel' },
      { label: 'Look for', value: 'Third-row access, rear AC' },
    ],
    browseLabel: 'Browse family cars',
    emptyMessage: 'No family cars are listed right now. New cars go live as dealers add them.',
    featured: false,
  },
  {
    key: 'low-km',
    title: 'Low kilometres',
    shortLabel: 'Low km',
    icon: 'odometer',
    params: { maxKm: '100000' },
    description:
      'Driven less than 1,00,000 km. Less wear on the engine, clutch and suspension, and more years of driving left.',
    facts: [
      { label: 'Distance', value: 'Under 1,00,000 km' },
      { label: 'Best for', value: 'Keeping the car longer' },
      { label: 'Look for', value: 'Service record that matches the odometer' },
    ],
    browseLabel: 'Browse low-kilometre cars',
    emptyMessage:
      'No cars under 1,00,000 km are listed right now. New cars go live as dealers add them.',
    featured: true,
  },
];

export const RECENT_ROW_ID = 'home-recent';

export const HOME_TEXT = {
  eyebrow: 'Independent dealers · one trusted platform',
  title: 'Find your next car',
  lede: 'Used cars from independent dealerships across Tamil Nadu. Reviewed before they go live, priced by the dealer.',
  recentTitle: 'Recently added',
  viewAll: 'View all →',
  discoveryLabel: 'Cars on Dealers-Drive now',
  unavailableTitle: 'We couldn’t load these vehicles right now',
  unavailableMessage: 'Please try again, or browse every car on the marketplace.',
} as const;

export function categoryAnchor(key: HomeCategoryKey): string {
  return `home-category-${key}`;
}
