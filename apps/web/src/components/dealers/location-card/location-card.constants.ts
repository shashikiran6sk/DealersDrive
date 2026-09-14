export const LOCATION_CARD_TEXT = {
  heading: 'Location',
  mapPlaceholder: 'Map — dealership location',
  directions: 'Get directions',
  mapTitle: (brandName: string, city?: string) =>
    `Map showing ${brandName}${city ? ` in ${city}` : ''}`,
} as const;
