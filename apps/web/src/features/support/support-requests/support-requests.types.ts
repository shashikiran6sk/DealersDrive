import type {
  CustomerEnquiry,
  CustomerSupportTicket,
  CustomerSupportTicketsResponse,
  SupportTicketCategory,
  SupportTicketRow,
} from '@dealers-drive/contracts';

import type {
  CreateSupportRequestResult,
  ReplySupportRequestResult,
  SupportRequestDraft,
} from '@/features/support/support-actions';

export interface SupportRequestListProps {
  tickets: CustomerSupportTicketsResponse;
}

export interface SupportRequestRowProps {
  ticket: SupportTicketRow;
}

export interface SupportRequestFormProps {
  enquiries: CustomerEnquiry[];
  initialSubject?: string;
  initialCategory?: SupportTicketCategory;
  initialEnquiryId?: string;
  submit?: (draft: SupportRequestDraft) => Promise<CreateSupportRequestResult>;
}

export interface SupportRequestDetailProps {
  ticket: CustomerSupportTicket;
}

export interface SupportReplyFormProps {
  ticketId: string;
  hint: string | null;
  send?: (ticketId: string, message: string) => Promise<ReplySupportRequestResult>;
}
