import { z } from 'zod';

import { CursorPage, formatKm } from './common.js';
import {
  BodyType,
  FUEL_LABELS,
  FuelType,
  InsuranceType,
  ListingStatus,
  StatusTone,
  PriceNegotiability,
  TRANSMISSION_LABELS,
  Transmission,
  VehicleColor,
} from './enums.js';
import { DealerListing, ListingLifecycleAction } from './listing.js';
import { RegistrationNumber } from './registration.js';

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
  color: VehicleColor,
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

/**
 * A vehicle's title without its leading year, for the surfaces that already
 * show the year beside it in a year plate (the card and the vehicle page).
 * `vehicleTitle` puts the year first, so this is its inverse and nothing more:
 * a title that does not start with that year, or is only the year, comes back
 * unchanged. The full title stays what every other reader uses — the page
 * title, image alt text, structured data, the dealer console.
 */
export function titleWithoutYear(vehicle: { title: string; year: number | null }): string {
  if (vehicle.year === null) return vehicle.title;
  const prefix = `${String(vehicle.year)} `;
  const rest = vehicle.title.startsWith(prefix) ? vehicle.title.slice(prefix.length).trim() : '';
  return rest || vehicle.title;
}

/**
 * `Petrol · Automatic · 22,400 km` — the meta line under a vehicle's title, in
 * the order DESIGN-SPEC §2.8 gives it. Parts not yet entered are skipped.
 */
export function vehicleSummary(vehicle: {
  fuelType: FuelType | null;
  transmission: Transmission | null;
  kilometersDriven: number | null;
}): string {
  return [
    vehicle.fuelType ? FUEL_LABELS[vehicle.fuelType] : null,
    vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null,
    vehicle.kilometersDriven === null ? null : formatKm(vehicle.kilometersDriven),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

// ─────────── dealer API (F063) ─────────────────────────────────────────────

/**
 * A draft starts from its registration number and nothing else — the first
 * wizard step. Everything after it is a `PATCH`.
 */
export const CreateVehicleInput = z.object({ registrationNumber: RegistrationNumber }).strict();
export type CreateVehicleInput = z.infer<typeof CreateVehicleInput>;

/**
 * One wizard step's worth of fields, or any subset of them.
 *
 * Every field may be omitted (left as it is) and every optional one may be
 * `null` (cleared). `.strict()` is the defence this schema exists for: a dealer
 * posting `status`, `dealerId`, `mediaId`, `imageUrl`, `storageKey`,
 * `publishedAt` or `verified` gets a 400 that names the field (rules 1, 2, 5;
 * R45) — those values are the server's.
 */
export const UpdateVehicleInput = z
  .object({
    registrationNumber: RegistrationNumber.optional(),
    make: VehicleFieldSchemas.make.nullable().optional(),
    model: VehicleFieldSchemas.model.nullable().optional(),
    variant: VehicleFieldSchemas.variant.nullable().optional(),
    manufacturingYear: VehicleFieldSchemas.manufacturingYear.nullable().optional(),
    registrationYear: VehicleFieldSchemas.registrationYear.nullable().optional(),
    fuelType: VehicleFieldSchemas.fuelType.nullable().optional(),
    transmission: VehicleFieldSchemas.transmission.nullable().optional(),
    bodyType: VehicleFieldSchemas.bodyType.nullable().optional(),
    kilometersDriven: VehicleFieldSchemas.kilometersDriven.nullable().optional(),
    ownerCount: VehicleFieldSchemas.ownerCount.nullable().optional(),
    color: VehicleFieldSchemas.color.nullable().optional(),
    insuranceType: VehicleFieldSchemas.insuranceType.nullable().optional(),
    insuranceValidUntil: VehicleFieldSchemas.insuranceValidUntil.nullable().optional(),
    pricePaise: VehicleFieldSchemas.pricePaise.nullable().optional(),
    negotiability: VehicleFieldSchemas.negotiability.nullable().optional(),
    description: VehicleFieldSchemas.description.nullable().optional(),
  })
  .strict();
export type UpdateVehicleInput = z.infer<typeof UpdateVehicleInput>;

export const VehicleSuggestField = z.enum(['make', 'model']);
export type VehicleSuggestField = z.infer<typeof VehicleSuggestField>;

/** "What have other dealers called this?" — the suggest-existing guard rail (D1, R46). */
export const VehicleSuggestQuery = z
  .object({
    field: VehicleSuggestField,
    q: z.string().trim().min(1).max(VEHICLE_LIMITS.textMax),
  })
  .strict();
export type VehicleSuggestQuery = z.infer<typeof VehicleSuggestQuery>;

export const VehicleSuggestions = z.object({
  field: VehicleSuggestField,
  values: z.array(z.string()),
});
export type VehicleSuggestions = z.infer<typeof VehicleSuggestions>;

export const VehicleIssueDto = z.object({ field: z.string(), message: z.string() });

/**
 * A vehicle as its own dealership sees it.
 *
 * Three DTOs describe a vehicle and they are deliberately separate: this one,
 * the moderator's (which adds review context) and the buyer's (which removes
 * everything that is not for sale). None of them is the Prisma row.
 *
 * `issues` is `vehicleIssues()` evaluated by the API, so the console renders
 * what is missing rather than re-deriving it.
 */
export const DealerVehicle = z.object({
  id: z.string().uuid(),
  title: z.string(),
  registrationNumber: z.string(),
  registrationDisplay: z.string(),
  rtoCode: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  variant: z.string().nullable(),
  manufacturingYear: z.number().int().nullable(),
  registrationYear: z.number().int().nullable(),
  fuelType: FuelType.nullable(),
  transmission: Transmission.nullable(),
  bodyType: BodyType.nullable(),
  kilometersDriven: z.number().int().nullable(),
  ownerCount: z.number().int().nullable(),
  color: VehicleColor.nullable(),
  insuranceType: InsuranceType.nullable(),
  insuranceValidUntil: z.string().nullable(),
  pricePaise: z.number().int().nullable(),
  priceLabel: z.string().nullable(),
  negotiability: PriceNegotiability.nullable(),
  description: z.string().nullable(),
  summary: z.string(),
  issues: z.array(VehicleIssueDto),
  complete: z.boolean(),
  listing: DealerListing,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DealerVehicle = z.infer<typeof DealerVehicle>;

// ─────────── dealer inventory (F066) ───────────────────────────────────────

/**
 * The inventory filter. `status` is a listing status; omitting it is "All".
 * `q` matches the registration number (separators ignored) or the make/model.
 */
export const DealerInventoryQuery = z
  .object({
    status: ListingStatus.optional(),
    q: z.string().trim().min(1).max(60).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type DealerInventoryQuery = z.infer<typeof DealerInventoryQuery>;

/** One inventory row: identity, price and where the listing stands. */
export const DealerInventoryRow = z.object({
  id: z.string().uuid(),
  title: z.string(),
  registrationDisplay: z.string(),
  summary: z.string(),
  priceLabel: z.string().nullable(),
  status: ListingStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  reason: z.string().nullable(),
  complete: z.boolean(),
  /** The public address once it has been live (**R69**). */
  slug: z.string().nullable(),
  /** The lifecycle moves this row offers now (**R69**). */
  actions: z.array(ListingLifecycleAction),
  /** A request to put this car back on sale is waiting for an admin. */
  reactivationPending: z.boolean(),
  updatedAt: z.string(),
  updatedLabel: z.string(),
});
export type DealerInventoryRow = z.infer<typeof DealerInventoryRow>;

/**
 * A page of the inventory, with the count of every status so the filter tabs
 * need no second request. `counts.ALL` is the whole inventory; the counts
 * ignore `q` and `status`, so switching tab never empties the tab bar.
 */
export const DealerInventoryResponse = z.object({
  data: z.array(DealerInventoryRow),
  page: CursorPage,
  counts: z.record(z.string(), z.number().int()),
});
export type DealerInventoryResponse = z.infer<typeof DealerInventoryResponse>;
