export const CARD_IMAGE_WIDTH = 640;

export const IMAGE_ALT = (title: string): string => `${title}, the primary photograph`;

export const DETAIL_IMAGE_WIDTH = 1024;

export const GALLERY_ALT = (title: string, index: number, total: number): string =>
  `${title}, photograph ${index + 1} of ${total}`;

export const VEHICLE_NOT_FOUND = 'That car is not on Dealers-Drive.';

export const DEALER_NOT_FOUND = 'That dealership is not listed.';

export const RTO_LABEL = 'Registered at';

export const PUBLISHED = (date: string): string => `Listed ${date}`;
