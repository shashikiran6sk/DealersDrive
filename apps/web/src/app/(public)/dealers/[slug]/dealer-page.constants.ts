export interface DealerDescriptionInput {
  brandName: string;
  tagline: string | null;
  place: string | null;
  isVerified: boolean;
}

export const DEALER_PAGE_TEXT = {
  notFoundTitle: 'Dealership not found',
  inventoryUnavailableTitle: 'We couldn’t load this dealership’s cars right now',
  inventoryUnavailableMessage: 'The dealership’s details are above. Please try again for its cars.',
  coverAlt: (brandName: string) => `${brandName} dealership yard`,
  metaDescription: ({ brandName, tagline, place, isVerified }: DealerDescriptionInput) =>
    [
      tagline,
      `${brandName} is a${isVerified ? ' verified' : 'n'} independent used-car dealer${place ? ` in ${place}` : ''}.`,
      'Browse the cars it has available and enquire directly on Dealers-Drive.',
    ]
      .filter(Boolean)
      .join(' '),
} as const;
