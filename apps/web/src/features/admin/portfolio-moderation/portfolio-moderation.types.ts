import type { AdminPortfolioPhoto, AdminPortfolioQueue } from '@dealers-drive/contracts';

export type PortfolioModerationStatus = 'PENDING' | 'REJECTED';

export interface PortfolioModerationTab {
  value: PortfolioModerationStatus;
  label: string;
}

export interface PortfolioModerationQueueProps {
  queue: AdminPortfolioQueue;
  status: PortfolioModerationStatus;
}

export interface PortfolioModerationTabsProps {
  active: PortfolioModerationStatus;
}

export interface PortfolioModerationCardProps {
  photo: AdminPortfolioPhoto;
}

export interface PortfolioPreviewProps {
  url: string | null;
  alt: string;
  label: string;
  fallback: string;
}
