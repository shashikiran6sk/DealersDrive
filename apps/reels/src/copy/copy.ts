import type { Bilingual } from '../reel/reel.types';

import { cyclic } from '../lib/pick';

import { ENGLISH_MONTHS, TAMIL_MONTHS } from './tamil';

export const COPY = {
  kicker: { en: 'Pre-owned cars', ta: 'பயன்படுத்திய கார்கள்' },
  verified: { en: 'Verified dealer', ta: 'சரிபார்க்கப்பட்ட டீலர்' },
  servicesHeading: { en: 'Services offered', ta: 'வழங்கப்படும் சேவைகள்' },
  featured: { en: 'Featured cars', ta: 'சிறப்பு கார்கள்' },
  price: { en: 'Price', ta: 'விலை' },
  priceOnRequest: { en: 'Price on request', ta: 'விலைக்கு விசாரிக்கவும்' },
  priceRange: { en: 'Price range', ta: 'விலை வரம்பு' },
  scan: { en: 'Scan to see every car', ta: 'அனைத்து கார்களையும் காண ஸ்கேன் செய்யுங்கள்' },
  site: 'dealers-drive.com',
  presentedBy: { en: 'On Dealers-Drive', ta: 'Dealers-Drive-இல்' },
} as const satisfies Record<string, Bilingual | string>;

export function availableLabel(count: number): Bilingual {
  return {
    en: count === 1 ? 'car available' : 'cars available',
    ta: 'கார்கள் விற்பனைக்கு',
  };
}

export function featuredIndex(position: number, total: number): string {
  return `${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

export function pricesAsOf(date: Date): Bilingual {
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  return {
    en: `Prices as of ${day} ${cyclic(ENGLISH_MONTHS, month, '')} ${year}`,
    ta: `விலைகள் ${day} ${cyclic(TAMIL_MONTHS, month, '')} ${year} நிலவரப்படி`,
  };
}
