import {
  CUSTOMER_ENQUIRY_STATUS_LABELS,
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_STATUS_TONES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
  SUPPORT_TICKET_TRANSITIONS,
  SupportTicketPriority,
  SupportTicketStatus,
  canCustomerReply,
  customerEnquiryStatus,
  formatDate,
  formatDateTime,
  formatPhone,
  formatRegistration,
  isListingPubliclyVisible,
  listingStatusLabel,
  listingStatusTone,
  supportTicketReference,
  vehicleTitle,
  type AdminSupportTicketDetail,
  type AdminSupportTicketRow,
  type SupportAssignee,
  type SupportHistoryEntry,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { mediaUrl } from '../../platform/media/urls.js';
import { UNNAMED_CUSTOMER } from '../../platform/messages.js';
import {
  ASSIGNED_TO,
  BY_CUSTOMER_REPLY,
  SUPPORT_ACTOR_LABELS,
  SUPPORT_AUTHOR_LABEL,
  SUPPORT_HISTORY_LABELS,
  UNKNOWN_ADMIN,
  VEHICLE_IMAGE_ALT,
} from './support.messages.js';

export const ADMIN_IMAGE_WIDTH = 640;

const VEHICLE_SELECT = {
  manufacturingYear: true,
  make: true,
  model: true,
  variant: true,
  registrationNumber: true,
} satisfies Prisma.VehicleSelect;

const PERSON_SELECT = { id: true, fullName: true, email: true } satisfies Prisma.UserSelect;

export const ADMIN_ROW_SELECT = {
  id: true,
  number: true,
  subject: true,
  category: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true } },
  assignee: { select: PERSON_SELECT },
  enquiry: {
    select: {
      id: true,
      dealer: { select: { brandName: true } },
      listing: { select: { vehicle: { select: VEHICLE_SELECT } } },
    },
  },
} satisfies Prisma.SupportTicketSelect;

export type AdminRowSource = Prisma.SupportTicketGetPayload<{ select: typeof ADMIN_ROW_SELECT }>;

export const ADMIN_DETAIL_SELECT = {
  ...ADMIN_ROW_SELECT,
  description: true,
  resolvedAt: true,
  closedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, createdAt: true } },
  enquiry: {
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      dealer: {
        select: { id: true, brandName: true, status: true, contactPhone: true },
      },
      listing: {
        select: {
          id: true,
          status: true,
          slug: true,
          dealer: { select: { status: true } },
          vehicle: {
            select: {
              ...VEHICLE_SELECT,
              images: { where: { isPrimary: true }, select: { mediaId: true }, take: 1 },
            },
          },
        },
      },
    },
  },
  messages: {
    select: {
      id: true,
      authorType: true,
      body: true,
      createdAt: true,
      author: { select: PERSON_SELECT },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  notes: {
    select: { id: true, body: true, createdAt: true, author: { select: PERSON_SELECT } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.SupportTicketSelect;

export type AdminDetailSource = Prisma.SupportTicketGetPayload<{
  select: typeof ADMIN_DETAIL_SELECT;
}>;

export interface Person {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface SupportHistorySource {
  action: string;
  actorType: string;
  actorId: string | null;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
  createdAt: Date;
}

export function personLabel(person: Person | null): string {
  if (!person) return UNKNOWN_ADMIN;
  return person.fullName?.trim() || person.email || UNKNOWN_ADMIN;
}

export function toAssignee(person: Person): SupportAssignee {
  return { id: person.id, label: personLabel(person), email: person.email ?? '' };
}

function customerName(fullName: string | null): string {
  return fullName?.trim() || UNNAMED_CUSTOMER;
}

function vehicleName(vehicle: Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>): string {
  return vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber);
}

export function toAdminSupportRow(row: AdminRowSource): AdminSupportTicketRow {
  return {
    id: row.id,
    reference: supportTicketReference(row.number),
    subject: row.subject,
    category: row.category,
    categoryLabel: SUPPORT_CATEGORY_LABELS[row.category],
    status: row.status,
    statusLabel: SUPPORT_STATUS_LABELS[row.status],
    statusTone: SUPPORT_STATUS_TONES[row.status],
    priority: row.priority,
    priorityLabel: SUPPORT_PRIORITY_LABELS[row.priority],
    priorityTone: SUPPORT_PRIORITY_TONES[row.priority],
    customer: {
      id: row.customer.id,
      name: customerName(row.customer.fullName),
      phoneDisplay: row.customer.phone ? formatPhone(row.customer.phone) : null,
    },
    context: row.enquiry
      ? {
          enquiryId: row.enquiry.id,
          vehicleTitle: vehicleName(row.enquiry.listing.vehicle),
          registrationDisplay: formatRegistration(row.enquiry.listing.vehicle.registrationNumber),
          dealerName: row.enquiry.dealer.brandName,
        }
      : null,
    assignee: row.assignee ? toAssignee(row.assignee) : null,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: formatDateTime(row.updatedAt),
  };
}

function field(value: Prisma.JsonValue, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const found = value[key];
  return typeof found === 'string' ? found : null;
}

function statusName(value: string | null): string | null {
  const parsed = SupportTicketStatus.safeParse(value);
  return parsed.success ? SUPPORT_STATUS_LABELS[parsed.data] : null;
}

function priorityName(value: string | null): string | null {
  const parsed = SupportTicketPriority.safeParse(value);
  return parsed.success ? SUPPORT_PRIORITY_LABELS[parsed.data] : null;
}

function transition(from: string | null, to: string | null): string | null {
  return from && to ? `${from} → ${to}` : null;
}

function detailOf(row: SupportHistorySource, people: Map<string, Person>): string | null {
  if (row.action === 'support_ticket.priority_changed') {
    return transition(
      priorityName(field(row.before, 'priority')),
      priorityName(field(row.after, 'priority')),
    );
  }
  if (row.action === 'support_ticket.assigned') {
    const id = field(row.after, 'assignedAdminId');
    return ASSIGNED_TO(personLabel(id ? (people.get(id) ?? null) : null));
  }
  const moved = transition(
    statusName(field(row.before, 'status')),
    statusName(field(row.after, 'status')),
  );
  if (moved && field(row.after, 'cause') === 'customer_reply')
    return `${moved} ${BY_CUSTOMER_REPLY}`;
  return moved;
}

export function supportHistoryOf(
  rows: SupportHistorySource[],
  people: Map<string, Person>,
): SupportHistoryEntry[] {
  return rows.map((row) => {
    const base = SUPPORT_ACTOR_LABELS[row.actorType] ?? row.actorType;
    const person = row.actorType === 'ADMIN' && row.actorId ? people.get(row.actorId) : undefined;
    return {
      action: row.action,
      label: SUPPORT_HISTORY_LABELS[row.action] ?? row.action,
      detail: detailOf(row, people),
      actor: person ? `${base} · ${personLabel(person)}` : base,
      at: row.createdAt.toISOString(),
      atLabel: formatDateTime(row.createdAt),
    };
  });
}

function vehicleOf(
  enquiry: NonNullable<AdminDetailSource['enquiry']>,
): AdminSupportTicketDetail['vehicle'] {
  const listing = enquiry.listing;
  const title = vehicleName(listing.vehicle);
  const primary = listing.vehicle.images[0];
  const live = isListingPubliclyVisible(listing.status) && listing.dealer.status === 'ACTIVE';
  return {
    listingId: listing.id,
    title,
    registrationDisplay: formatRegistration(listing.vehicle.registrationNumber),
    listingStatus: listing.status,
    listingStatusLabel: listingStatusLabel(listing.status),
    listingStatusTone: listingStatusTone(listing.status),
    image: primary
      ? { url: mediaUrl(primary.mediaId, ADMIN_IMAGE_WIDTH), alt: VEHICLE_IMAGE_ALT(title) }
      : null,
    publicHref: live && listing.slug ? `/car/${listing.slug}` : null,
    adminHref: `/admin/listings/${listing.id}`,
  };
}

export function toAdminSupportDetail(
  row: AdminDetailSource,
  extras: {
    ticketCount: number;
    history: SupportHistoryEntry[];
    assignees: SupportAssignee[];
  },
): AdminSupportTicketDetail {
  const enquiry = row.enquiry;
  const customer = customerName(row.customer.fullName);
  return {
    ...toAdminSupportRow(row),
    description: row.description,
    resolvedLabel: row.resolvedAt ? formatDateTime(row.resolvedAt) : null,
    closedLabel: row.closedAt ? formatDateTime(row.closedAt) : null,
    canReply: canCustomerReply(row.status),
    transitions: [...SUPPORT_TICKET_TRANSITIONS[row.status]],
    customer: {
      id: row.customer.id,
      name: customer,
      phone: row.customer.phone,
      phoneDisplay: row.customer.phone ? formatPhone(row.customer.phone) : null,
      memberSinceLabel: formatDate(row.customer.createdAt),
      ticketCount: extras.ticketCount,
    },
    enquiry: enquiry
      ? {
          id: enquiry.id,
          statusLabel: ENQUIRY_STATUS_LABELS[enquiry.status],
          customerStatusLabel:
            CUSTOMER_ENQUIRY_STATUS_LABELS[customerEnquiryStatus(enquiry.status)],
          statusTone: ENQUIRY_STATUS_TONES[enquiry.status],
          sentLabel: formatDateTime(enquiry.createdAt),
          message: enquiry.message,
          adminHref: `/admin/enquiries/${enquiry.id}`,
        }
      : null,
    vehicle: enquiry ? vehicleOf(enquiry) : null,
    dealer: enquiry
      ? {
          id: enquiry.dealer.id,
          name: enquiry.dealer.brandName,
          statusLabel: DEALER_STATUS_LABELS[enquiry.dealer.status],
          statusTone: DEALER_STATUS_TONES[enquiry.dealer.status],
          phoneDisplay: enquiry.dealer.contactPhone
            ? formatPhone(enquiry.dealer.contactPhone)
            : null,
          adminHref: `/admin/dealers/${enquiry.dealer.id}`,
        }
      : null,
    messages: row.messages.map((message) => ({
      id: message.id,
      author: message.authorType,
      authorLabel: message.authorType === 'CUSTOMER' ? customer : SUPPORT_AUTHOR_LABEL,
      authorName: message.authorType === 'CUSTOMER' ? customer : personLabel(message.author),
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      createdLabel: formatDateTime(message.createdAt),
    })),
    notes: row.notes.map((note) => ({
      id: note.id,
      authorName: personLabel(note.author),
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      createdLabel: formatDateTime(note.createdAt),
    })),
    history: extras.history,
    assignees: extras.assignees,
  };
}
