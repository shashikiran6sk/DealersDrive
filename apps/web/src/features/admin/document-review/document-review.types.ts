import type { AdminDealerDetail } from '@dealers-drive/contracts';

export type AdminDocument = AdminDealerDetail['documents'][number];

export type DocumentHistoryEntry = AdminDealerDetail['documentHistory'][number];

export interface DocumentReviewProps {
  documents: AdminDocument[];
  dealerSlug: string;
  gaps?: string[];
  history?: DocumentHistoryEntry[];
}
