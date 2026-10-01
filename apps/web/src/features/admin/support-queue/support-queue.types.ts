import type {
  AdminSupportTicketRow,
  AdminSupportTicketsResponse,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@dealers-drive/contracts';

export interface SupportQueueFilters {
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  priority?: SupportTicketPriority;
  assignee?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface SupportQueueProps {
  tickets: AdminSupportTicketsResponse;
  filters: SupportQueueFilters;
}

export interface SupportQueueRowProps {
  row: AdminSupportTicketRow;
}
