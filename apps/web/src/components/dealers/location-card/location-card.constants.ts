export const LOCATION_CARD_TEXT = {
  heading: 'Location',
  directions: 'Get Directions',
  location: (name: string) => `${name} location`,
  unavailable: 'Address unavailable',
  directionsUnavailable: 'Directions are unavailable for this location.',
} as const;
