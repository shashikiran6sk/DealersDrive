import type { PublicPortfolioPhoto } from '@dealers-drive/contracts';

export interface DealerGalleryProps {
  photos: readonly PublicPortfolioPhoto[];
  brandName: string;
  className?: string;
}
