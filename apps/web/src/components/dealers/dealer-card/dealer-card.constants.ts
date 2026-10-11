export const CARD_HEIGHT = 'h-[330px]';

export const COVER_HEIGHT = 'h-[112px]';
export const TILE_SIZE = 48;

export const SERVICES_SHOWN = 3;

import { countLabel } from '@/lib/plural';

export const DEALER_CARD_TEXT = {
  verifiedDealer: 'Dealer Verified',
  coverAlt:
    'Standard conceptual dealership illustration shared by all Dealers-Drive directory cards',
  carsListed: (carCount: number) => `${countLabel(carCount, 'car')} listed`,
} as const;
