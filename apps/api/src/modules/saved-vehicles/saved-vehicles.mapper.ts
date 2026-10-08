import {
  isListingPubliclyVisible,
  publicAvailabilityOf,
  type PublicAvailability,
  type SavedVehicle,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { PUBLIC_DEALER_STATUS, cardInclude, toVehicleCard } from '../search/search.facade.js';

export const savedInclude = {
  listing: {
    include: {
      ...cardInclude,
      dealer: { select: { ...cardInclude.dealer.select, status: true } },
    },
  },
} satisfies Prisma.SavedVehicleInclude;

export type SavedRow = Prisma.SavedVehicleGetPayload<{ include: typeof savedInclude }>;

export function savedAvailability(listing: SavedRow['listing']): PublicAvailability {
  const onMarketplace =
    listing.marketplacePublished &&
    isListingPubliclyVisible(listing.status) &&
    listing.dealer.status === PUBLIC_DEALER_STATUS &&
    listing.slug !== null;
  if (onMarketplace) return publicAvailabilityOf(listing.status);
  return listing.status === 'SOLD' ? 'SOLD' : 'UNAVAILABLE';
}

export function toSavedVehicle(row: SavedRow): SavedVehicle {
  const card = toVehicleCard(row.listing);
  const availability = savedAvailability(row.listing);
  const shown = availability === 'AVAILABLE' || availability === 'RESERVED';
  return {
    savedAt: row.createdAt.toISOString(),
    vehicle: { ...card, availability, image: shown ? card.image : null },
  };
}
