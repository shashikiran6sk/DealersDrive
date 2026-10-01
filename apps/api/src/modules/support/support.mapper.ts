import {
  CUSTOMER_ENQUIRY_STATUS_LABELS,
  CUSTOMER_SUPPORT_STATUS_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_TONES,
  canCustomerReply,
  customerEnquiryStatus,
  formatDate,
  formatDateTime,
  formatRegistration,
  isListingPubliclyVisible,
  supportTicketReference,
  vehicleTitle,
  type CustomerSupportEnquiry,
  type CustomerSupportTicket,
  type SupportMessage,
  type SupportTicketRow,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { CUSTOMER_AUTHOR_LABEL, SUPPORT_AUTHOR_LABEL } from './support.messages.js';

export const TICKET_ROW_SELECT = {
  id: true,
  number: true,
  subject: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportTicketSelect;

export type TicketRowSource = Prisma.SupportTicketGetPayload<{ select: typeof TICKET_ROW_SELECT }>;

export const CUSTOMER_ENQUIRY_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  dealer: { select: { brandName: true } },
  listing: {
    select: {
      status: true,
      slug: true,
      dealer: { select: { status: true } },
      vehicle: {
        select: {
          manufacturingYear: true,
          make: true,
          model: true,
          variant: true,
          registrationNumber: true,
        },
      },
    },
  },
} satisfies Prisma.EnquirySelect;

export type CustomerEnquirySource = Prisma.EnquiryGetPayload<{
  select: typeof CUSTOMER_ENQUIRY_SELECT;
}>;

export const MESSAGE_SELECT = {
  id: true,
  authorType: true,
  body: true,
  createdAt: true,
} satisfies Prisma.SupportTicketMessageSelect;

export const CUSTOMER_TICKET_SELECT = {
  ...TICKET_ROW_SELECT,
  description: true,
  enquiry: { select: CUSTOMER_ENQUIRY_SELECT },
  messages: { select: MESSAGE_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.SupportTicketSelect;

export type CustomerTicketSource = Prisma.SupportTicketGetPayload<{
  select: typeof CUSTOMER_TICKET_SELECT;
}>;

export function toSupportTicketRow(
  row: TicketRowSource,
  statusLabels: Record<TicketRowSource['status'], string> = CUSTOMER_SUPPORT_STATUS_LABELS,
): SupportTicketRow {
  return {
    id: row.id,
    reference: supportTicketReference(row.number),
    subject: row.subject,
    category: row.category,
    categoryLabel: SUPPORT_CATEGORY_LABELS[row.category],
    status: row.status,
    statusLabel: statusLabels[row.status],
    statusTone: SUPPORT_STATUS_TONES[row.status],
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: formatDateTime(row.updatedAt),
  };
}

export function toSupportMessage(
  row: Prisma.SupportTicketMessageGetPayload<{ select: typeof MESSAGE_SELECT }>,
  customerLabel: string = CUSTOMER_AUTHOR_LABEL,
): SupportMessage {
  return {
    id: row.id,
    author: row.authorType,
    authorLabel: row.authorType === 'CUSTOMER' ? customerLabel : SUPPORT_AUTHOR_LABEL,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
  };
}

export function toCustomerSupportEnquiry(row: CustomerEnquirySource): CustomerSupportEnquiry {
  const vehicle = row.listing.vehicle;
  const live =
    isListingPubliclyVisible(row.listing.status) && row.listing.dealer.status === 'ACTIVE';
  return {
    id: row.id,
    vehicleTitle: vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber),
    dealerName: row.dealer.brandName,
    statusLabel: CUSTOMER_ENQUIRY_STATUS_LABELS[customerEnquiryStatus(row.status)],
    sentLabel: formatDate(row.createdAt),
    vehicleHref: live && row.listing.slug ? `/car/${row.listing.slug}` : null,
  };
}

export function toCustomerSupportTicket(row: CustomerTicketSource): CustomerSupportTicket {
  return {
    ...toSupportTicketRow(row),
    description: row.description,
    canReply: canCustomerReply(row.status),
    messages: row.messages.map((message) => toSupportMessage(message)),
    enquiry: row.enquiry ? toCustomerSupportEnquiry(row.enquiry) : null,
  };
}
