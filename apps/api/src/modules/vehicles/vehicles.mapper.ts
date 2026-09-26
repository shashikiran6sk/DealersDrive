import {
  formatRegistration,
  formatRupees,
  vehicleIssues,
  vehicleSummary,
  vehicleTitle,
  type DealerVehicle,
  type VehicleCompletenessInput,
} from '@dealers-drive/contracts';

import type { VehicleRow } from './vehicles.repository.js';

export function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function completenessOf(row: VehicleRow): VehicleCompletenessInput {
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

export function toDealerVehicle(row: VehicleRow): DealerVehicle {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
