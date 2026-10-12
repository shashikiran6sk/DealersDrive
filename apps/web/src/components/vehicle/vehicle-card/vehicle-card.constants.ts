export const VEHICLE_CARD_TEXT = {
  verified: 'Dealer Verified',
  noPhoto: 'Photographs coming soon',
  priceOnRequest: 'Price on request',
  photoCount: (count: number) => `${count} photos`,
  reserved: 'Reserved',
  reservedNote: 'Reserved for another buyer',
} as const;

export function vehicleHref(slug: string): string {
  return `/car/${encodeURIComponent(slug)}`;
}
