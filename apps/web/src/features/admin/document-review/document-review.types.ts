import type { AdminDealerDetail } from '@dealers-drive/contracts';

export type AdminDocument = AdminDealerDetail['documents'][number];

export interface DocumentReviewProps {
  documents: AdminDocument[];
  /**
   * The dealership these documents belong to, for cache invalidation only.
   * Rejecting one can hand a PENDING_APPROVAL application back to DRAFT, and a
   * dealership that is not ACTIVE is not public — so a decision here can remove
   * a portfolio from the marketplace, and the cached copy has to go with it.
   */
  dealerSlug: string;
}
