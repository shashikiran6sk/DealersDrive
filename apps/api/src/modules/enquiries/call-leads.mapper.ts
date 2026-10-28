import {
  formatDate,
  formatPhone,
  formatRegistration,
  initialsOf,
  isListingPubliclyVisible,
  timeAgo,
  vehicleTitle,
  type AdminCallLead,
  type CallLead,
} from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { UNNAMED_CUSTOMER } from '../../platform/messages.js';

export const CALL_LEAD_SELECT = {
  id: true,
  firstRevealedAt: true,
  lastRevealedAt: true,
  revealCount: true,
  customer: { select: { fullName: true, phone: true } },
  dealer: { select: { brandName: true, slug: true, status: true } },
  listing: {
    select: {
      status: true,
      slug: true,
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
} satisfies Prisma.CallLeadSelect;

export type CallLeadRow = Prisma.CallLeadGetPayload<{ select: typeof CALL_LEAD_SELECT }>;

export function toCallLead(row: CallLeadRow, now: Date = new Date()): CallLead {
  const name = row.customer.fullName?.trim() || UNNAMED_CUSTOMER;
  const phone = row.customer.phone;
  const vehicle = row.listing.vehicle;
  const registrationDisplay = formatRegistration(vehicle.registrationNumber);
  const live = isListingPubliclyVisible(row.listing.status) && row.dealer.status === 'ACTIVE';

  return {
    id: row.id,
    customer: {
      name,
      initials: initialsOf(name),
      phoneDisplay: phone ? formatPhone(phone) : null,
      callHref: phone ? `tel:${phone}` : null,
    },
    vehicle: {
      title: vehicleTitle(vehicle) || registrationDisplay,
      registrationDisplay,
      href: live && row.listing.slug ? `/car/${row.listing.slug}` : null,
    },
    revealCount: row.revealCount,
    firstRevealedLabel: formatDate(row.firstRevealedAt),
    lastRevealedAt: row.lastRevealedAt.toISOString(),
    lastRevealedAgoLabel: timeAgo(row.lastRevealedAt, now),
  };
}

export function toAdminCallLead(row: CallLeadRow, now: Date = new Date()): AdminCallLead {
  return {
    ...toCallLead(row, now),
    dealer: { name: row.dealer.brandName, slug: row.dealer.slug },
  };
}
