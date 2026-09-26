import type { AdminVehicleImages } from '@dealers-drive/contracts';

export interface ListingImagesProps {
  listingId: string;
  images: AdminVehicleImages;
}

export interface UploadProgress {
  done: number;
  total: number;
}
