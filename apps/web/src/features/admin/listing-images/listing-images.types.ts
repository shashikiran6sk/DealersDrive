import type { AdminVehicleImages, PhotoCredit } from '@dealers-drive/contracts';

export interface ListingImagesProps {
  listingId: string;
  images: AdminVehicleImages;
  live?: boolean;
  defaultCredit?: PhotoCredit | null;
}

export interface UploadProgress {
  done: number;
  total: number;
}

export type UploadTarget = { credit: PhotoCredit } | { replacesMediaId: string };
