import {
  BODY_TYPE_LABELS,
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  FUEL_LABELS,
  INSURANCE_LABELS,
  LISTING_CHECK_LABELS,
  ListingCheckKey,
  PHOTOGRAPHY_STATUS_LABELS,
  PHOTOGRAPHY_STATUS_TONES,
  NEGOTIABILITY_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_FIELD_LABELS,
  formatDate,
  formatKm,
  formatPhone,
  formatRegistration,
  formatRupees,
  listingStatusLabel,
  listingStatusTone,
  ownerLabel,
  timeAgo,
  vehicleIssues,
  vehicleSummary,
  vehicleTitle,
  type AdminListingDetail,
  type AdminListingRow,
  type AdminVehicleImages,
  type PhotographyDto,
  type PhotographyStatus,
} from '@dealers-drive/contracts';

import { completenessOf } from '../vehicles/vehicles.facade.js';
import { approvalBlockers } from './moderation.approval.js';
import { ACTOR_LABELS, HISTORY_LABELS, SECTION_TITLES } from './moderation.messages.js';
import type { DetailRow, HistoryRow, QueueRow } from './moderation.repository.js';

export function locationOf(dealer: {
  city: string | null;
  district: string | null;
}): string | null {
  const parts = [dealer.city, dealer.district].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export function photographyOf(record: { status: PhotographyStatus } | null): PhotographyDto {
  const status = record?.status ?? 'NOT_STARTED';
  return {
    status,
    label: PHOTOGRAPHY_STATUS_LABELS[status],
    tone: PHOTOGRAPHY_STATUS_TONES[status],
  };
}

export const PHOTOGRAPHY_OPEN_STATUSES = ['PENDING_REVIEW', 'CHANGES_REQUESTED'] as const;

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
    photography: photographyOf(vehicle.photography),
    imageCount: vehicle._count.images,
  };
}

function row(
  label: string,
  value: string | number | null | undefined,
): { label: string; value: string | null } {
  return {
    label,
    value: value === null || value === undefined || value === '' ? null : String(value),
  };
}

export function sectionsOf(vehicle: DetailRow['vehicle']): AdminListingDetail['sections'] {
  return [
    {
      key: 'registration',
      title: SECTION_TITLES.registration,
      rows: [
        row(
          VEHICLE_FIELD_LABELS.registrationNumber,
          formatRegistration(vehicle.registrationNumber),
        ),
        row('RTO', vehicle.rtoCode),
        row(VEHICLE_FIELD_LABELS.registrationYear, vehicle.registrationYear),
      ],
    },
    {
      key: 'basics',
      title: SECTION_TITLES.basics,
      rows: [
        row(VEHICLE_FIELD_LABELS.make, vehicle.make),
        row(VEHICLE_FIELD_LABELS.model, vehicle.model),
        row(VEHICLE_FIELD_LABELS.variant, vehicle.variant),
        row(VEHICLE_FIELD_LABELS.manufacturingYear, vehicle.manufacturingYear),
        row(VEHICLE_FIELD_LABELS.fuelType, vehicle.fuelType && FUEL_LABELS[vehicle.fuelType]),
        row(
          VEHICLE_FIELD_LABELS.transmission,
          vehicle.transmission && TRANSMISSION_LABELS[vehicle.transmission],
        ),
        row(VEHICLE_FIELD_LABELS.bodyType, vehicle.bodyType && BODY_TYPE_LABELS[vehicle.bodyType]),
      ],
    },
    {
      key: 'details',
      title: SECTION_TITLES.details,
      rows: [
        row(
          VEHICLE_FIELD_LABELS.kilometersDriven,
          vehicle.kilometersDriven === null ? null : formatKm(vehicle.kilometersDriven),
        ),
        row(VEHICLE_FIELD_LABELS.ownerCount, vehicle.ownerCount && ownerLabel(vehicle.ownerCount)),
        row(VEHICLE_FIELD_LABELS.color, vehicle.color),
        row(
          VEHICLE_FIELD_LABELS.insuranceType,
          vehicle.insuranceType && INSURANCE_LABELS[vehicle.insuranceType],
        ),
        row(
          VEHICLE_FIELD_LABELS.insuranceValidUntil,
          vehicle.insuranceValidUntil && formatDate(vehicle.insuranceValidUntil),
        ),
      ],
    },
    {
      key: 'pricing',
      title: SECTION_TITLES.pricing,
      rows: [
        row(
          VEHICLE_FIELD_LABELS.pricePaise,
          vehicle.pricePaise === null ? null : formatRupees(vehicle.pricePaise),
        ),
        row('Negotiable', vehicle.negotiability && NEGOTIABILITY_LABELS[vehicle.negotiability]),
      ],
    },
  ];
}

function reasonOf(after: unknown): string | null {
  if (typeof after !== 'object' || after === null || !('reason' in after)) return null;
  return typeof after.reason === 'string' ? after.reason : null;
}

export function historyOf(rows: HistoryRow[]): AdminListingDetail['history'] {
  return rows.map((entry) => ({
    action: entry.action,
    label: HISTORY_LABELS[entry.action] ?? entry.action,
    actor: ACTOR_LABELS[entry.actorType] ?? entry.actorType,
    reason: reasonOf(entry.after),
    at: entry.createdAt.toISOString(),
    atLabel: formatDate(entry.createdAt),
  }));
}

export function toAdminListingDetail(
  listing: DetailRow,
  history: HistoryRow[],
  images: AdminVehicleImages,
  now: Date = new Date(),
): AdminListingDetail {
  const reviewing = listing.status === 'PENDING_REVIEW';
  const checked = new Map(listing.checks.map((check) => [check.key, check.checkedAt]));
  const blockers = reviewing
    ? approvalBlockers({
        dealerStatus: listing.dealer.status,
        dealerCity: listing.dealer.city,
        vehicle: listing.vehicle,
        checkedKeys: listing.checks.map((check) => check.key),
        imageCount: images.items.length,
        hasPrimary: images.items.some((image) => image.isPrimary),
        minImages: images.min,
      })
    : [];

  return {
    listing: {
      ...toAdminListingRow(listing, now),
      reason: listing.decisionReason,
      submissionCount: listing.submissionCount,
      publishedAt: listing.publishedAt?.toISOString() ?? null,
    },
    dealer: {
      id: listing.dealer.id,
      name: listing.dealer.brandName,
      slug: listing.dealer.slug,
      status: listing.dealer.status,
      statusLabel: DEALER_STATUS_LABELS[listing.dealer.status],
      statusTone: DEALER_STATUS_TONES[listing.dealer.status],
      location: locationOf(listing.dealer),
      phoneDisplay: listing.dealer.contactPhone ? formatPhone(listing.dealer.contactPhone) : null,
    },
    sections: sectionsOf(listing.vehicle),
    description: listing.vehicle.description,
    issues: vehicleIssues(completenessOf(listing.vehicle)),
    photography: {
      ...photographyOf(listing.vehicle.photography),
      note: listing.vehicle.photography?.note ?? null,
      updatedAt: listing.vehicle.photography?.updatedAt.toISOString() ?? null,
      canUpdate: PHOTOGRAPHY_OPEN_STATUSES.some((status) => status === listing.status),
    },
    images,
    checks: ListingCheckKey.options.map((key) => ({
      key,
      label: LISTING_CHECK_LABELS[key].label,
      hint: LISTING_CHECK_LABELS[key].hint,
      checked: checked.has(key),
      checkedAt: checked.get(key)?.toISOString() ?? null,
    })),
    history: historyOf(history),
    blockers,
    actions: {
      canVerify: reviewing,
      canRequestChanges: reviewing,
      canReject: reviewing,
      canApprove: reviewing && blockers.length === 0,
    },
  };
}
