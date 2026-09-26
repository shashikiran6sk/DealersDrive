import {
  formatDate,
  formatRegistration,
  formatRupees,
  listingStatusLabel,
  listingStatusTone,
  timeAgo,
  vehicleSummary,
  vehicleTitle,
  type AdminListingRow,
} from '@dealers-drive/contracts';

import type { QueueRow } from './moderation.repository.js';

export function locationOf(dealer: {
  city: string | null;
  district: string | null;
}): string | null {
  const parts = [dealer.city, dealer.district].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export function toAdminListingRow(row: QueueRow, now: Date = new Date()): AdminListingRow {
  const vehicle = row.vehicle;
  const submitted = row.lastSubmittedAt;

  return {
    id: row.id,
    vehicleId: vehicle.id,
    title: vehicleTitle(vehicle) || formatRegistration(vehicle.registrationNumber),
    registrationDisplay: formatRegistration(vehicle.registrationNumber),
    summary: vehicleSummary(vehicle),
    priceLabel: vehicle.pricePaise === null ? null : formatRupees(vehicle.pricePaise),
    status: row.status,
    statusLabel: listingStatusLabel(row.status),
    statusTone: listingStatusTone(row.status),
    dealer: { id: row.dealer.id, name: row.dealer.brandName, slug: row.dealer.slug },
    location: locationOf(row.dealer),
    submittedAt: submitted?.toISOString() ?? null,
    submittedLabel: submitted ? formatDate(submitted) : null,
    waitingLabel: submitted && row.status === 'PENDING_REVIEW' ? timeAgo(submitted, now) : null,
    resubmission: row.submissionCount > 1,
  };
}
