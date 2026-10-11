export const CARD_HEIGHT = 'h-[330px]';

export const COVER_HEIGHT = 'h-[112px]';
export const TILE_SIZE = 48;

export const SERVICES_SHOWN = 3;

import { countLabel } from '@/lib/plural';

export const DEALER_CARD_TEXT = {
  approvedDealer: 'APPROVED DEALER',
  verifiedDealer: 'VERIFIED DEALER',
  coverAlt: (brandName: string) => `${brandName} — dealership image`,
  carsListed: (carCount: number) => `${countLabel(carCount, 'car')} listed`,
} as const;
