import type { AdminVehicleImages, PhotoCredit } from '@dealers-drive/contracts';

export interface ListingImagesProps {
  listingId: string;
  images: AdminVehicleImages;
  live?: boolean;
}

export interface UploadProgress {
  done: number;
  total: number;
}

export type UploadTarget = { credit: PhotoCredit } | { replacesMediaId: string };
