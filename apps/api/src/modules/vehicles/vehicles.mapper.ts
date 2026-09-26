import {
  formatDate,
  formatRegistration,
  isListingDeletable,
  isListingEditable,
  isListingSubmittable,
  listingStatusLabel,
  listingStatusTone,
  formatRupees,
  vehicleIssues,
  vehicleSummary,
  vehicleTitle,
  type DealerInventoryRow,
  type DealerListing,
  type DealerVehicle,
  type VehicleCompletenessInput,
} from '@dealers-drive/contracts';
import type { Listing, Vehicle } from '@prisma/client';

import type { VehicleRow } from './vehicles.repository.js';

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

export function toDealerListing(listing: Listing, complete: boolean): DealerListing {
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
    canEdit: isListingEditable(listing.status),
    canSubmit: complete && isListingSubmittable(listing.status),
    canDelete: isListingDeletable(listing.status),
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
    updatedAt: row.updatedAt.toISOString(),
    updatedLabel: formatDate(row.updatedAt),
  };
}
