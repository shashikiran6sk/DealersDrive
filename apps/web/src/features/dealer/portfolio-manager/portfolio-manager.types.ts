import type { DealerPortfolioPhoto, DealerPortfolioResponse } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

export interface PortfolioPaths {
  presign: string;
  commit: string;
  remove: string;
}

export interface PortfolioSubmission {
  caption: string;
  replacesId?: string;
}

export type PortfolioOutcome = string | null;

export interface PortfolioManagerProps {
  portfolio: DealerPortfolioResponse;
  paths?: PortfolioPaths;
}

export interface PortfolioPhotoCardProps {
  photo: DealerPortfolioPhoto;
  position: number;
  replacesPosition: number | null;
  replacementPending: boolean;
  onReplace: (file: File, caption: string) => Promise<PortfolioOutcome>;
  onRemove: () => Promise<PortfolioOutcome>;
}

export interface PortfolioUploadDialogProps {
  title: string;
  description: string;
  trigger: ReactNode;
  onSubmit: (file: File, caption: string) => Promise<PortfolioOutcome>;
}

export interface PortfolioRemoveDialogProps {
  title: string;
  description: string;
  trigger: ReactNode;
  onConfirm: () => Promise<PortfolioOutcome>;
}
