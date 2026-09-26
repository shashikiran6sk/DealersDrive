import { z } from 'zod';

import { BodyType, FuelType, InsuranceType, PriceNegotiability, Transmission } from './enums.js';

/**
 * The vehicle a dealership enters by hand (**F055**, as revised by **R45** and
 * **R46**).
 *
 * Every limit lives here once, because both apps enforce it: the wizard to show
 * the message beside the field, the API because it is the authority. The same
 * ranges are CHECK constraints on `vehicles`, so a value that slipped past both
 * would still be refused by the database.
 *
 * There is deliberately nothing about images in this module. A dealer never
 * uploads a listing photograph (R45) — no schema a dealer can write accepts a
 * media id, an image URL or a storage key.
 */
export const VEHICLE_LIMITS = {
  minYear: 1950,
  /** Next year's model is on sale in the last quarter; a year beyond that is a typo. */
  maxYearAhead: 1,
  maxKilometers: 2_000_000,
  minOwners: 1,
  maxOwners: 20,
  /** ₹10,000 — below this is a typo in the number of zeros, not a car. */
  minPricePaise: 1_000_000,
  /** ₹20 crore. */
  maxPricePaise: 20_000_000_000,
  textMax: 60,
  colorMax: 40,
  descriptionMax: 2000,
} as const;

export function maxVehicleYear(now: Date = new Date()): number {
  return now.getUTCFullYear() + VEHICLE_LIMITS.maxYearAhead;
}

/**
 * `"  Maruti   Suzuki "` -> `"Maruti Suzuki"`.
 *
 * Whitespace only. Case is left as typed, because `BMW`, `MG` and `Mercedes-Benz`
 * are all correct and a rule that title-cased them would be wrong three ways.
 * The API goes one step further on write and adopts the spelling already in use
 * for the same make or model, compared case-insensitively — see
 * `vehicles.service.ts` — which is what stops `maruti suzuki` becoming a second
 * facet of the first.
 */
export function normaliseVehicleText(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

const VehicleText = (max: number) =>
  z
    .string()
    .transform(normaliseVehicleText)
    .pipe(z.string().min(1, 'Enter a value.').max(max, `Keep this under ${max} characters.`));

const Year = z
  .number()
  .int()
  .min(VEHICLE_LIMITS.minYear, `Enter a year from ${VEHICLE_LIMITS.minYear}.`)
  .refine((year) => year <= maxVehicleYear(), 'That year is in the future.');

export const VehicleFieldSchemas = {
  make: VehicleText(VEHICLE_LIMITS.textMax),
  model: VehicleText(VEHICLE_LIMITS.textMax),
  variant: VehicleText(VEHICLE_LIMITS.textMax),
  manufacturingYear: Year,
  registrationYear: Year,
  fuelType: FuelType,
  transmission: Transmission,
  bodyType: BodyType,
  kilometersDriven: z
    .number()
    .int('Enter whole kilometres.')
    .min(0, 'The reading cannot be negative.')
    .max(VEHICLE_LIMITS.maxKilometers, 'Check the odometer reading.'),
  ownerCount: z
    .number()
    .int()
    .min(VEHICLE_LIMITS.minOwners, 'A car has had at least one owner.')
    .max(VEHICLE_LIMITS.maxOwners, 'Check the number of owners.'),
  color: VehicleText(VEHICLE_LIMITS.colorMax),
  insuranceType: InsuranceType,
  insuranceValidUntil: z.iso.date('Enter a date as YYYY-MM-DD.'),
  pricePaise: z
    .number()
    .int()
    .min(VEHICLE_LIMITS.minPricePaise, 'Enter a price of at least ₹10,000.')
    .max(VEHICLE_LIMITS.maxPricePaise, 'Check the price.'),
  negotiability: PriceNegotiability,
  description: z
    .string()
    .trim()
    .max(VEHICLE_LIMITS.descriptionMax, 'Keep the description under 2,000 characters.'),
} as const;

/** The fields a vehicle must carry before it can be submitted for review. */
export const REQUIRED_VEHICLE_FIELDS = [
  'registrationNumber',
  'make',
  'model',
  'manufacturingYear',
  'fuelType',
  'transmission',
  'bodyType',
  'kilometersDriven',
  'ownerCount',
  'color',
  'insuranceType',
  'pricePaise',
] as const;
export type RequiredVehicleField = (typeof REQUIRED_VEHICLE_FIELDS)[number];

export const VEHICLE_FIELD_LABELS: Record<
  RequiredVehicleField | 'variant' | 'registrationYear' | 'insuranceValidUntil' | 'description',
  string
> = {
  registrationNumber: 'Registration number',
  make: 'Make',
  model: 'Model',
  variant: 'Variant',
  manufacturingYear: 'Manufacturing year',
  registrationYear: 'Registration year',
  fuelType: 'Fuel',
  transmission: 'Transmission',
  bodyType: 'Body type',
  kilometersDriven: 'Kilometres driven',
  ownerCount: 'Owners',
  color: 'Colour',
  insuranceType: 'Insurance',
  insuranceValidUntil: 'Insurance valid until',
  pricePaise: 'Price',
  description: 'Description',
};

/** The shape completeness is judged on — a stored row or a DTO, both fit. */
export interface VehicleCompletenessInput {
  registrationNumber: string | null;
  make: string | null;
  model: string | null;
  manufacturingYear: number | null;
  registrationYear: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  kilometersDriven: number | null;
  ownerCount: number | null;
  color: string | null;
  insuranceType: string | null;
  insuranceValidUntil: string | Date | null;
  pricePaise: number | bigint | null;
}

export interface VehicleIssue {
  field: string;
  message: string;
}

/**
 * Everything standing between this vehicle and a submission, in wizard order.
 *
 * One function, imported by the wizard and by the API, so the console can never
 * offer a Submit the server would refuse — or refuse one it would accept. An
 * empty array is the only answer that means "complete".
 *
 * Beyond presence it checks the two rules that span fields: a car cannot be
 * registered before it was built, and insurance other than `NONE` needs the date
 * it runs to, because "comprehensive, expired in 2019" is the thing a buyer
 * actually needs to know.
 */
export function vehicleIssues(vehicle: VehicleCompletenessInput): VehicleIssue[] {
  const issues: VehicleIssue[] = [];

  for (const field of REQUIRED_VEHICLE_FIELDS) {
    const value = vehicle[field];
    if (value === null || value === '') {
      issues.push({ field, message: `${VEHICLE_FIELD_LABELS[field]} is required.` });
    }
  }

  if (
    vehicle.manufacturingYear !== null &&
    vehicle.registrationYear !== null &&
    vehicle.registrationYear < vehicle.manufacturingYear
  ) {
    issues.push({
      field: 'registrationYear',
      message: 'The car cannot be registered before it was manufactured.',
    });
  }

  if (
    vehicle.insuranceType !== null &&
    vehicle.insuranceType !== 'NONE' &&
    vehicle.insuranceValidUntil === null
  ) {
    issues.push({
      field: 'insuranceValidUntil',
      message: 'Enter the date the insurance is valid until.',
    });
  }

  return issues;
}

/** `vehicleIssues` as a yes/no, for the places that only need the answer. */
export function isVehicleComplete(vehicle: VehicleCompletenessInput): boolean {
  return vehicleIssues(vehicle).length === 0;
}

/** `2023 Hyundai Creta SX(O)` — the one way a vehicle is named across the product. */
export function vehicleTitle(vehicle: {
  manufacturingYear: number | null;
  make: string | null;
  model: string | null;
  variant: string | null;
}): string {
  return [vehicle.manufacturingYear, vehicle.make, vehicle.model, vehicle.variant]
    .filter((part) => part !== null && part !== '')
    .join(' ');
}
