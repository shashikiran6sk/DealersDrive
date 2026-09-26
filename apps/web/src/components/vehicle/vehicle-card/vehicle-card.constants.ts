export const VEHICLE_CARD_TEXT = {
  verified: 'Verified',
  noPhoto: 'Photographs coming soon',
  priceOnRequest: 'Price on request',
  photoCount: (count: number) => `${count} photos`,
} as const;

export function vehicleHref(slug: string): string {
  return `/car/${encodeURIComponent(slug)}`;
}
