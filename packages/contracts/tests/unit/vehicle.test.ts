import { describe, expect, it } from 'vitest';

import {
  CreateVehicleInput,
  REQUIRED_VEHICLE_FIELDS,
  UpdateVehicleInput,
  VehicleSuggestQuery,
  VEHICLE_FIELD_LABELS,
  VEHICLE_LIMITS,
  VehicleFieldSchemas,
  isVehicleComplete,
  maxVehicleYear,
  normaliseVehicleText,
  vehicleIssues,
  vehicleSummary,
  vehicleTitle,
  type VehicleCompletenessInput,
} from '../../src/vehicle.js';

function complete(overrides: Partial<VehicleCompletenessInput> = {}): VehicleCompletenessInput {
  return {
    registrationNumber: 'KA01AB1234',
    make: 'Hyundai',
    model: 'Creta',
    manufacturingYear: 2021,
    registrationYear: 2021,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
    kilometersDriven: 22_400,
    ownerCount: 1,
    color: 'Polar White',
    insuranceType: 'COMPREHENSIVE',
    insuranceValidUntil: '2027-03-31',
    pricePaise: 145_000_000,
    ...overrides,
  };
}

describe('normaliseVehicleText', () => {
  it('trims and collapses whitespace', () => {
    expect(normaliseVehicleText('  Maruti   Suzuki ')).toBe('Maruti Suzuki');
  });

  it('leaves case exactly as typed', () => {
    expect(normaliseVehicleText('BMW')).toBe('BMW');
    expect(normaliseVehicleText('SX(O)')).toBe('SX(O)');
  });
});

describe('VehicleFieldSchemas', () => {
  it('normalises free text on the way in', () => {
    expect(VehicleFieldSchemas.make.parse('  Tata  Motors ')).toBe('Tata Motors');
  });

  it('refuses an empty make once the whitespace is gone', () => {
    expect(VehicleFieldSchemas.make.safeParse('   ').success).toBe(false);
  });

  it('refuses text over the limit', () => {
    expect(
      VehicleFieldSchemas.model.safeParse('x'.repeat(VEHICLE_LIMITS.textMax + 1)).success,
    ).toBe(false);
  });

  it('refuses a year before the floor and after next year', () => {
    expect(VehicleFieldSchemas.manufacturingYear.safeParse(1949).success).toBe(false);
    expect(VehicleFieldSchemas.manufacturingYear.safeParse(maxVehicleYear()).success).toBe(true);
    expect(VehicleFieldSchemas.manufacturingYear.safeParse(maxVehicleYear() + 1).success).toBe(
      false,
    );
  });

  it('refuses a negative or fractional odometer', () => {
    expect(VehicleFieldSchemas.kilometersDriven.safeParse(-1).success).toBe(false);
    expect(VehicleFieldSchemas.kilometersDriven.safeParse(10.5).success).toBe(false);
    expect(VehicleFieldSchemas.kilometersDriven.safeParse(0).success).toBe(true);
  });

  it('refuses zero owners', () => {
    expect(VehicleFieldSchemas.ownerCount.safeParse(0).success).toBe(false);
    expect(VehicleFieldSchemas.ownerCount.safeParse(1).success).toBe(true);
  });

  it('keeps money in integer paise with a floor and a ceiling', () => {
    expect(VehicleFieldSchemas.pricePaise.safeParse(145_000_000).success).toBe(true);
    expect(VehicleFieldSchemas.pricePaise.safeParse(999_999).success).toBe(false);
    expect(VehicleFieldSchemas.pricePaise.safeParse(1_450_000.5).success).toBe(false);
    expect(VehicleFieldSchemas.pricePaise.safeParse(VEHICLE_LIMITS.maxPricePaise + 1).success).toBe(
      false,
    );
  });

  it('takes the insurance date as an ISO calendar date', () => {
    expect(VehicleFieldSchemas.insuranceValidUntil.safeParse('2027-03-31').success).toBe(true);
    expect(VehicleFieldSchemas.insuranceValidUntil.safeParse('31/03/2027').success).toBe(false);
  });

  it('has no field for an image, a status or a dealer', () => {
    const fields = Object.keys(VehicleFieldSchemas);
    for (const forbidden of ['dealerId', 'status', 'mediaId', 'imageUrl', 'storageKey']) {
      expect(fields).not.toContain(forbidden);
    }
  });
});

describe('vehicleIssues', () => {
  it('finds nothing wrong with a complete vehicle', () => {
    expect(vehicleIssues(complete())).toEqual([]);
    expect(isVehicleComplete(complete())).toBe(true);
  });

  it('names every missing required field, in wizard order', () => {
    const empty = complete(
      Object.fromEntries(REQUIRED_VEHICLE_FIELDS.map((field) => [field, null])),
    );

    expect(vehicleIssues(empty).map((issue) => issue.field)).toEqual([...REQUIRED_VEHICLE_FIELDS]);
    expect(isVehicleComplete(empty)).toBe(false);
  });

  it('treats an empty string as missing', () => {
    expect(vehicleIssues(complete({ color: '' }))).toEqual([
      { field: 'color', message: 'Colour is required.' },
    ]);
  });

  it('refuses a registration before manufacture', () => {
    const issues = vehicleIssues(complete({ manufacturingYear: 2022, registrationYear: 2021 }));
    expect(issues.map((issue) => issue.field)).toEqual(['registrationYear']);
  });

  it('asks for the insurance date unless there is no insurance', () => {
    expect(vehicleIssues(complete({ insuranceValidUntil: null }))[0]?.field).toBe(
      'insuranceValidUntil',
    );
    expect(vehicleIssues(complete({ insuranceType: 'NONE', insuranceValidUntil: null }))).toEqual(
      [],
    );
  });

  it('labels every required field', () => {
    for (const field of REQUIRED_VEHICLE_FIELDS) {
      expect(VEHICLE_FIELD_LABELS[field]).toBeTruthy();
    }
  });
});

describe('vehicleTitle', () => {
  it('reads year, make, model and variant', () => {
    expect(
      vehicleTitle({ manufacturingYear: 2023, make: 'Hyundai', model: 'Creta', variant: 'SX(O)' }),
    ).toBe('2023 Hyundai Creta SX(O)');
  });

  it('skips what has not been entered yet', () => {
    expect(vehicleTitle({ manufacturingYear: null, make: 'Tata', model: null, variant: '' })).toBe(
      'Tata',
    );
  });
});

describe('vehicleSummary', () => {
  it('reads fuel, gearbox and odometer in that order', () => {
    expect(
      vehicleSummary({ fuelType: 'PETROL', transmission: 'AUTOMATIC', kilometersDriven: 22_400 }),
    ).toBe('Petrol · Automatic · 22,400 km');
  });

  it('skips what is missing, and keeps a zero odometer', () => {
    expect(vehicleSummary({ fuelType: null, transmission: 'MANUAL', kilometersDriven: 0 })).toBe(
      'Manual · 0 km',
    );
    expect(vehicleSummary({ fuelType: null, transmission: null, kilometersDriven: null })).toBe('');
  });
});

describe('the dealer inputs', () => {
  it('creates a draft from a registration number, canonicalised', () => {
    expect(CreateVehicleInput.parse({ registrationNumber: 'ka-01-ab-1234' })).toEqual({
      registrationNumber: 'KA01AB1234',
    });
  });

  it.each(['status', 'dealerId', 'mediaId', 'imageUrl', 'storageKey', 'publishedAt', 'verified'])(
    'refuses a client-supplied %s by name',
    (field) => {
      const result = UpdateVehicleInput.safeParse({ make: 'Tata', [field]: 'x' });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain(field);
    },
  );

  it('lets a field be cleared with null and left alone by omission', () => {
    expect(UpdateVehicleInput.parse({ variant: null })).toEqual({ variant: null });
    expect(UpdateVehicleInput.parse({})).toEqual({});
  });

  it('asks only for make or model suggestions', () => {
    expect(VehicleSuggestQuery.safeParse({ field: 'make', q: 'Mar' }).success).toBe(true);
    expect(VehicleSuggestQuery.safeParse({ field: 'color', q: 'Red' }).success).toBe(false);
    expect(VehicleSuggestQuery.safeParse({ field: 'make', q: '  ' }).success).toBe(false);
  });
});
