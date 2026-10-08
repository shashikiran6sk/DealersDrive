import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
  supportTicketReference,
  CUSTOMER_ENQUIRY_STATUS_LABELS,
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_STATUS_TONES,
  EnquiryStatus,
  customerEnquiryStatus,
  formatDate,
  formatDateTime,
  formatPhone,
  formatRegistration,
  isListingPubliclyVisible,
  listingStatusLabel,
  listingStatusTone,
  vehicleTitle,
  type AdminEnquiryDetail,
  type AdminEnquiryHistoryEntry,
  type AdminEnquiryRow,
  type AdminEnquiryVehicle,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { mediaUrl } from '../../platform/media/urls.js';
import { UNNAMED_CUSTOMER } from '../../platform/messages.js';
import {
  ENQUIRY_ACTOR_LABELS,
  ENQUIRY_HISTORY_LABELS,
  ENQUIRY_IMAGE_ALT,
} from './enquiries.messages.js';

export const ADMIN_PREVIEW_LENGTH = 120;

export const ADMIN_IMAGE_WIDTH = 640;

const VEHICLE_SELECT = {
  manufacturingYear: true,
  make: true,
  model: true,
  variant: true,
  registrationNumber: true,
} satisfies Prisma.VehicleSelect;

export const ADMIN_ROW_SELECT = {
  id: true,
  source: true,
  status: true,
  message: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true, phone: true } },
  dealer: { select: { id: true, brandName: true, slug: true } },
  listing: { select: { id: true, status: true, vehicle: { select: VEHICLE_SELECT } } },
} satisfies Prisma.EnquirySelect;

export type AdminRowSource = Prisma.EnquiryGetPayload<{ select: typeof ADMIN_ROW_SELECT }>;

export const ADMIN_DETAIL_SELECT = {
  id: true,
  source: true,
  storefrontHostname: true,
  status: true,
  message: true,
  createdAt: true,
  contactedAt: true,
  closedAt: true,
  customer: {
    select: { id: true, fullName: true, phone: true, createdAt: true },
  },
  dealer: {
    select: {
      id: true,
      brandName: true,
      slug: true,
      status: true,
      city: true,
      district: true,
      contactPhone: true,
    },
  },
  listing: {
    select: {
      id: true,
      marketplacePublished: true,
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
} satisfies Prisma.EnquirySelect;

export type AdminDetailSource = Prisma.EnquiryGetPayload<{ select: typeof ADMIN_DETAIL_SELECT }>;

export interface EnquiryHistorySource {
  action: string;
  actorType: string;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
  createdAt: Date;
}

function customerName(fullName: string | null): string {
  return fullName?.trim() || UNNAMED_CUSTOMER;
}

function previewOf(message: string | null): string | null {
  if (message === null) return null;
  const firstLine = message.split('\n').find((line) => line.trim() !== '') ?? '';
  const line = firstLine.trim();
  return line.length > ADMIN_PREVIEW_LENGTH
    ? `${line.slice(0, ADMIN_PREVIEW_LENGTH - 1).trimEnd()}…`
    : line;
}

function vehicleOf(listing: AdminRowSource['listing']): AdminEnquiryVehicle {
  const registrationDisplay = formatRegistration(listing.vehicle.registrationNumber);
  return {
    listingId: listing.id,
    title: vehicleTitle(listing.vehicle) || registrationDisplay,
    registrationDisplay,
    listingStatus: listing.status,
    listingStatusLabel: listingStatusLabel(listing.status),
    listingStatusTone: listingStatusTone(listing.status),
  };
}

export function toAdminEnquiryRow(row: AdminRowSource): AdminEnquiryRow {
  return {
    id: row.id,
    source: row.source ?? 'MARKETPLACE',
    sourceLabel: row.source === 'DEALER_WEBSITE' ? 'Dealer website' : 'Marketplace',
    status: row.status,
    statusLabel: ENQUIRY_STATUS_LABELS[row.status],
    statusTone: ENQUIRY_STATUS_TONES[row.status],
    messagePreview: previewOf(row.message),
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
    customer: {
      id: row.customer.id,
      name: customerName(row.customer.fullName),
      phoneDisplay: row.customer.phone ? formatPhone(row.customer.phone) : null,
    },
    dealer: { id: row.dealer.id, name: row.dealer.brandName, slug: row.dealer.slug },
    vehicle: vehicleOf(row.listing),
  };
}

function statusIn(value: Prisma.JsonValue): EnquiryStatus | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const parsed = EnquiryStatus.safeParse(value.status);
  return parsed.success ? parsed.data : null;
}

export function enquiryHistoryOf(rows: EnquiryHistorySource[]): AdminEnquiryHistoryEntry[] {
  return rows.map((row) => ({
    action: row.action,
    label: ENQUIRY_HISTORY_LABELS[row.action] ?? row.action,
    actor: ENQUIRY_ACTOR_LABELS[row.actorType] ?? row.actorType,
    fromStatus: statusIn(row.before),
    toStatus: row.action === 'enquiry.created' ? 'NEW' : statusIn(row.after),
    at: row.createdAt.toISOString(),
    atLabel: formatDateTime(row.createdAt),
  }));
}

function locationOf(dealer: AdminDetailSource['dealer']): string | null {
  const parts = [dealer.city, dealer.district].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return parts.length > 0 ? [...new Set(parts)].join(', ') : null;
}

function publicHrefOf(listing: AdminDetailSource['listing']): string | null {
  const live =
    listing.marketplacePublished &&
    isListingPubliclyVisible(listing.status) &&
    listing.dealer.status === 'ACTIVE';
  return live && listing.slug ? `/car/${listing.slug}` : null;
}

export interface EnquiryTicketSource {
  id: string;
  number: number;
  subject: string;
  status: keyof typeof SUPPORT_STATUS_LABELS;
  createdAt: Date;
}

export function toAdminEnquiryDetail(
  row: AdminDetailSource,
  history: EnquiryHistorySource[],
  tickets: EnquiryTicketSource[] = [],
): AdminEnquiryDetail {
  const name = customerName(row.customer.fullName);
  const vehicle = vehicleOf(row.listing);
  const primary = row.listing.vehicle.images[0];

  return {
    id: row.id,
    source: row.source ?? 'MARKETPLACE',
    sourceLabel: row.source === 'DEALER_WEBSITE' ? 'Dealer website' : 'Marketplace',
    storefrontHostname: row.storefrontHostname ?? null,
    status: row.status,
    statusLabel: ENQUIRY_STATUS_LABELS[row.status],
    statusTone: ENQUIRY_STATUS_TONES[row.status],
    customerStatusLabel: CUSTOMER_ENQUIRY_STATUS_LABELS[customerEnquiryStatus(row.status)],
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDateTime(row.createdAt),
    contactedLabel: row.contactedAt ? formatDateTime(row.contactedAt) : null,
    closedLabel: row.closedAt ? formatDateTime(row.closedAt) : null,
    customer: {
      id: row.customer.id,
      name,
      phone: row.customer.phone,
      phoneDisplay: row.customer.phone ? formatPhone(row.customer.phone) : null,
      phoneVerified: row.customer.phone !== null,
      memberSinceLabel: formatDate(row.customer.createdAt),
    },
    dealer: {
      id: row.dealer.id,
      name: row.dealer.brandName,
      slug: row.dealer.slug,
      statusLabel: DEALER_STATUS_LABELS[row.dealer.status],
      statusTone: DEALER_STATUS_TONES[row.dealer.status],
      location: locationOf(row.dealer),
      phoneDisplay: row.dealer.contactPhone ? formatPhone(row.dealer.contactPhone) : null,
      adminHref: `/admin/dealers/${row.dealer.id}`,
    },
    vehicle: {
      ...vehicle,
      image: primary
        ? {
            url: mediaUrl(primary.mediaId, ADMIN_IMAGE_WIDTH),
            alt: ENQUIRY_IMAGE_ALT(vehicle.title),
          }
        : null,
      publicHref: publicHrefOf(row.listing),
      adminHref: `/admin/listings/${row.listing.id}`,
    },
    history: enquiryHistoryOf(history),
    supportTickets: tickets.map((ticket) => ({
      id: ticket.id,
      reference: supportTicketReference(ticket.number),
      subject: ticket.subject,
      statusLabel: SUPPORT_STATUS_LABELS[ticket.status],
      statusTone: SUPPORT_STATUS_TONES[ticket.status],
      createdLabel: formatDateTime(ticket.createdAt),
    })),
  };
}
