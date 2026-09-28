export const CARD_IMAGE_WIDTH = 640;

export const IMAGE_ALT = (title: string): string => `${title}, the primary photograph`;

export const DETAIL_IMAGE_WIDTH = 1024;

export const GALLERY_ALT = (title: string, index: number, total: number): string =>
  `${title}, photograph ${index + 1} of ${total}`;

export const VEHICLE_NOT_FOUND = 'That car is not on Dealers-Drive.';

export const DEALER_NOT_FOUND = 'That dealership is not listed.';

export const RTO_LABEL = 'Registered at';

export const PUBLISHED = (date: string): string => `Listed ${date}`;

export const SUGGEST_KIND_LABEL = {
  BRAND: 'Brand',
  MODEL: 'Model',
  VARIANT: 'Variant',
} as const;

export const SUGGEST_META = (kind: keyof typeof SUGGEST_KIND_LABEL, count: number): string =>
  `${SUGGEST_KIND_LABEL[kind]} · ${count} ${count === 1 ? 'car' : 'cars'}`;

export const SUGGEST_COUNT = (total: number): string =>
  `${total} ${total === 1 ? 'match' : 'matches'}`;
