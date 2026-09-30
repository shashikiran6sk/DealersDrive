import type {
  AdminListingsResponse,
  AdminReactivationRow,
  AdminReactivationsResponse,
  ListingStatus,
} from '@dealers-drive/contracts';

import type { ListingActionResult } from '@/features/admin/listing-actions';

export type ModerationTab = ListingStatus | 'REACTIVATION';

export interface ModerationTabsProps {
  active: ModerationTab;
  counts: AdminListingsResponse['counts'];
  reactivationPending: number;
  q?: string | undefined;
}

export type ReactivationDecide = (requestId: string, note: string) => Promise<ListingActionResult>;

export interface ReactivationQueueProps {
  requests: AdminReactivationsResponse;
  listingCounts: AdminListingsResponse['counts'];
  approve?: ReactivationDecide;
  reject?: ReactivationDecide;
}

export interface ReactivationRowProps {
  row: AdminReactivationRow;
  approve: ReactivationDecide;
  reject: ReactivationDecide;
}
