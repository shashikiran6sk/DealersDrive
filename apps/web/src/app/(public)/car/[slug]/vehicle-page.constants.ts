export const VEHICLE_PAGE_TEXT = {
  back: '← All cars',
  specifications: 'Specifications',
  description: 'From the dealer',
  notFoundTitle: 'Car not found',
  metaTitle: (title: string, price: string | null) => (price ? `${title} — ${price}` : title),
  metaDescription: (title: string, summary: string, dealer: string) =>
    `${title}${summary ? `, ${summary}` : ''}. Sold by ${dealer}, a verified dealership on Dealers-Drive.`,
} as const;
