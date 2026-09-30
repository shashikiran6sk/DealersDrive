import {
  formatDate,
  formatRegistration,
  isListingDeletable,
  isListingEditable,
  isListingSubmittable,
  lifecycleActionsOf,
  listingStatusLabel,
  listingStatusTone,
  formatRupees,
  REACTIVATION_STATUS_LABELS,
  REACTIVATION_STATUS_TONES,
  vehicleIssues,
  vehicleSummary,
  vehicleTitle,
  withdrawalReasonLabel,
  type DealerInventoryRow,
  type DealerListing,
  type DealerVehicle,
  type ListingReactivation,
  type VehicleCompletenessInput,
} from '@dealers-drive/contracts';
import type { ListingReactivationRequest, Vehicle } from '@prisma/client';

import type { ListingRow, VehicleRow } from './vehicles.repository.js';

export function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function completenessOf(row: Vehicle): VehicleCompletenessInput {
  return {
    registrationNumber: row.registrationNumber,
    make: row.make,
    model: row.model,
    manufacturingYear: row.manufacturingYear,
    registrationYear: row.registrationYear,
    fuelType: row.fuelType,
    transmission: row.transmission,
    bodyType: row.bodyType,
    kilometersDriven: row.kilometersDriven,
    ownerCount: row.ownerCount,
    color: row.color,
    insuranceType: row.insuranceType,
    insuranceValidUntil: row.insuranceValidUntil,
    pricePaise: row.pricePaise,
  };
}

export function reactivationOf(
  listing: ListingRow,
  request: ListingReactivationRequest | undefined,
): ListingReactivation | null {
  if (!request) return null;
  if (request.status !== 'PENDING' && request.fromStatus !== listing.status) return null;
  return {
    id: request.id,
    status: request.status,
    statusLabel: REACTIVATION_STATUS_LABELS[request.status],
    statusTone: REACTIVATION_STATUS_TONES[request.status],
    fromStatus: request.fromStatus,
    reason: request.reason,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    adminNote: request.adminNote,
  };
}

export function toDealerListing(listing: ListingRow, complete: boolean): DealerListing {
  const reactivation = reactivationOf(listing, listing.reactivations?.[0]);
  return {
    id: listing.id,
    status: listing.status,
    statusLabel: listingStatusLabel(listing.status),
    statusTone: listingStatusTone(listing.status),
    reason:
      listing.status === 'CHANGES_REQUESTED' || listing.status === 'REJECTED'
        ? listing.decisionReason
        : null,
    submittedAt: listing.lastSubmittedAt?.toISOString() ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    slug: listing.slug,
    reservedAt: listing.reservedAt?.toISOString() ?? null,
    soldAt: listing.soldAt?.toISOString() ?? null,
    withdrawnAt: listing.withdrawnAt?.toISOString() ?? null,
    withdrawal:
      listing.status === 'WITHDRAWN' && listing.withdrawalReason
        ? {
            reason: listing.withdrawalReason,
            reasonLabel: withdrawalReasonLabel(listing.withdrawalReason),
            note: listing.withdrawalNote,
          }
        : null,
    canEdit: isListingEditable(listing.status),
    canSubmit: complete && isListingSubmittable(listing.status),
    canDelete: isListingDeletable(listing.status),
    actions: lifecycleActionsOf(listing.status, {
      reactivationPending: reactivation?.status === 'PENDING',
    }),
    reactivation,
  };
}

export function toDealerVehicle(row: VehicleRow): DealerVehicle {
  if (!row.listing) throw new Error(`Vehicle ${row.id} has no listing.`);
  const issues = vehicleIssues(completenessOf(row));
  const pricePaise = row.pricePaise === null ? null : Number(row.pricePaise);

  return {
    id: row.id,
    title: vehicleTitle(row) || formatRegistration(row.registrationNumber),
    registrationNumber: row.registrationNumber,
    registrationDisplay: formatRegistration(row.registrationNumber),
    rtoCode: row.rtoCode,
    make: row.make,
    model: row.model,
    variant: row.variant,
    manufacturingYear: row.manufacturingYear,
    registrationYear: row.registrationYear,
    fuelType: row.fuelType,
    transmission: row.transmission,
    bodyType: row.bodyType,
    kilometersDriven: row.kilometersDriven,
    ownerCount: row.ownerCount,
    color: row.color,
    insuranceType: row.insuranceType,
    insuranceValidUntil: isoDate(row.insuranceValidUntil),
    pricePaise,
    priceLabel: pricePaise === null ? null : formatRupees(pricePaise),
    negotiability: row.negotiability,
    description: row.description,
    summary: vehicleSummary(row),
    issues,
    complete: issues.length === 0,
    listing: toDealerListing(row.listing, issues.length === 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInventoryRow(row: VehicleRow): DealerInventoryRow {
  const vehicle = toDealerVehicle(row);
  return {
    id: vehicle.id,
    title: vehicle.title,
    registrationDisplay: vehicle.registrationDisplay,
    summary: vehicle.summary,
    priceLabel: vehicle.priceLabel,
    status: vehicle.listing.status,
    statusLabel: vehicle.listing.statusLabel,
    statusTone: vehicle.listing.statusTone,
    reason: vehicle.listing.reason,
    complete: vehicle.complete,
    slug: vehicle.listing.slug,
    actions: vehicle.listing.actions,
    reactivationPending: vehicle.listing.reactivation?.status === 'PENDING',
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: formatDate(row.updatedAt),
  };
}
