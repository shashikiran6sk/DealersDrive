import { STATUS_TEXT } from '@/components/errors/status-page';

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
  notFoundTitle: STATUS_TEXT.notFound.metaTitle,
  metaTitle: (title: string, city: string | null) =>
    city ? `Used ${title} for Sale in ${city}` : `Used ${title} for Sale`,
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
