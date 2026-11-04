export const YOUTUBE_TITLE_LIMIT = 100;
export const MAX_BRAND_TAGS = 3;
export const YOUTUBE_SOURCE = 'youtube';
export const SHORTS_TAG = '#Shorts';

export const CAPTION_COPY = {
  featuredReel: 'Featured in this reel:',
  featuredShort: 'Featured in this Short:',
  priceRange: (range: string) => `Price range: ${range}`,
  services: (list: string) => `Services offered: ${list}`,
  priceOnRequest: 'Price on request',
  pricesChange: (asOf: string) => `${asOf}. Prices may change.`,
  instagramHeadline: (name: string, place: string, stock: string, cars: string) =>
    `${name}, ${place} · ${stock} pre-owned ${cars} available on Dealers-Drive 🚗`,
  instagramFind: (name: string) =>
    `See every car: tap the link in our bio, go to Dealers, and search "${name}". Or scan the QR code in the reel.`,
  youtubeHeadline: (stock: string, cars: string, name: string, place: string) =>
    `${stock} pre-owned ${cars} at ${name}, ${place}. See every car on Dealers-Drive:`,
  youtubeTitle: (stock: string, cars: string, city: string, from: string, name: string) =>
    `${stock} Used ${cars} in ${city}${from} | ${name} ${SHORTS_TAG}`,
  youtubeShortTitle: (name: string, stock: string, cars: string) =>
    `${name}: ${stock} Used ${cars} ${SHORTS_TAG}`,
  fromPrice: (price: string) => ` from ${price}`,
  tamil: (name: string, place: string, stock: string) =>
    `${name}, ${place}: ${stock} பயன்படுத்திய கார்கள் விற்பனைக்கு. அனைத்து கார்களையும் Dealers-Drive-இல் பாருங்கள்.`,
  baseTags: ['DealersDrive', 'UsedCars', 'PreOwnedCars'],
  youtubeTags: ['UsedCars', 'DealersDrive'],
} as const;
