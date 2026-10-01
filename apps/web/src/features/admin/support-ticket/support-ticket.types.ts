import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';

import type { AdminSupportResult, TicketChanges } from '@/features/admin/support-actions';

export interface SupportTicketWorkspaceProps {
  ticket: AdminSupportTicketDetail;
  viewerId: string | null;
}

export interface TicketControlsProps {
  ticket: AdminSupportTicketDetail;
  viewerId: string | null;
  save?: (ticketId: string, changes: TicketChanges) => Promise<AdminSupportResult>;
}

export interface TicketComposerProps {
  ticketId: string;
  canReply: boolean;
  reply?: (ticketId: string, message: string) => Promise<AdminSupportResult>;
  note?: (ticketId: string, note: string) => Promise<AdminSupportResult>;
}
