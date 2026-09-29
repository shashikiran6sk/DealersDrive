export interface VehicleDescriptionInput {
  title: string;
  place: string | null;
  priceLabel: string | null;
  summary: string;
  dealerName: string;
  dealerVerified: boolean;
  reserved: boolean;
}

export const VEHICLE_PAGE_TEXT = {
  back: '← All cars',
  specifications: 'Specifications',
  description: 'From the dealer',
  notFoundTitle: 'Car not found',
  metaTitle: (title: string, city: string | null) => (city ? `${title} in ${city}` : title),
  metaDescription: ({
    title,
    place,
    priceLabel,
    summary,
    dealerName,
    dealerVerified,
    reserved,
  }: VehicleDescriptionInput) =>
    [
      reserved ? 'Reserved for another buyer.' : null,
      `${title} for sale${place ? ` in ${place}` : ''}${priceLabel ? ` at ${priceLabel}` : ''}${summary ? ` — ${summary}` : ''}.`,
      `Sold by ${dealerName}${dealerVerified ? ', a verified dealership' : ''} on Dealers-Drive.`,
    ]
      .filter(Boolean)
      .join(' '),
} as const;
