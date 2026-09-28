import {
  CUSTOMER_ENQUIRY_STATUS_LABELS,
  CUSTOMER_ENQUIRY_STATUS_TONES,
  customerEnquiryStatus,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_STATUS_TONES,
  formatDate,
  formatPhone,
  formatRegistration,
  initialsOf,
  timeAgo,
  vehicleTitle,
  type CustomerEnquiry,
  type DealerEnquiry,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { UNNAMED_CUSTOMER } from '../../platform/messages.js';

export const INBOX_SELECT = {
  id: true,
  status: true,
  message: true,
  createdAt: true,
  contactedAt: true,
  closedAt: true,
  customer: { select: { fullName: true, phone: true } },
  listing: {
    select: {
      status: true,
      slug: true,
      dealer: { select: { status: true } },
      vehicle: {
        select: {
          id: true,
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

export type InboxRow = Prisma.EnquiryGetPayload<{ select: typeof INBOX_SELECT }>;

function publicHref(
  listing: Pick<InboxRow['listing'], 'status' | 'slug' | 'dealer'>,
): string | null {
  const live = listing.status === 'ACTIVE' && listing.dealer.status === 'ACTIVE';
  return live && listing.slug ? `/car/${listing.slug}` : null;
}

export function toDealerEnquiry(row: InboxRow, now: Date = new Date()): DealerEnquiry {
  const name = row.customer.fullName?.trim() || UNNAMED_CUSTOMER;
  const phone = row.customer.phone;
  const vehicle = row.listing.vehicle;
  const registrationDisplay = formatRegistration(vehicle.registrationNumber);

  return {
    id: row.id,
    status: row.status,
    statusLabel: ENQUIRY_STATUS_LABELS[row.status],
    statusTone: ENQUIRY_STATUS_TONES[row.status],
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDate(row.createdAt),
    timeAgoLabel: timeAgo(row.createdAt, now),
    contactedAt: row.contactedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    customer: {
      name,
      initials: initialsOf(name),
      phone,
      phoneDisplay: phone ? formatPhone(phone) : null,
      callHref: phone ? `tel:${phone}` : null,
    },
    vehicle: {
      id: vehicle.id,
      title: vehicleTitle(vehicle) || registrationDisplay,
      registrationDisplay,
      listingStatus: row.listing.status,
      href: publicHref(row.listing),
    },
  };
}

export const CUSTOMER_SELECT = {
  id: true,
  status: true,
  message: true,
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

export type CustomerRow = Prisma.EnquiryGetPayload<{ select: typeof CUSTOMER_SELECT }>;

export function toCustomerEnquiry(row: CustomerRow): CustomerEnquiry {
  const status = customerEnquiryStatus(row.status);
  const vehicle = row.listing.vehicle;
  return {
    id: row.id,
    status,
    statusLabel: CUSTOMER_ENQUIRY_STATUS_LABELS[status],
    statusTone: CUSTOMER_ENQUIRY_STATUS_TONES[status],
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    createdLabel: formatDate(row.createdAt),
    dealerName: row.dealer.brandName,
    vehicle: {
      title: vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber),
      href: publicHref(row.listing),
    },
  };
}
