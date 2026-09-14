import type { AdminDealerDetail } from '@dealers-drive/contracts';

export type AdminDocument = AdminDealerDetail['documents'][number];

export interface DocumentReviewProps {
  documents: AdminDocument[];
  dealerSlug: string;
}
