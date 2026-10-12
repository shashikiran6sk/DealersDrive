import type { DealerPortfolioPhoto } from '@dealers-drive/contracts';

export interface DealerPortfolioSummaryProps {
  photos: DealerPortfolioPhoto[];
  dealerSlug: string;
}

export interface PortfolioTileProps {
  photo: DealerPortfolioPhoto;
  index: number;
  dealerSlug: string;
}
