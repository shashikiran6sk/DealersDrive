import { describe, expect, it } from 'vitest';

import {
  UpdateVehicleInput,
  VEHICLE_MAKES,
  VEHICLE_MAKE_ALIASES,
  canonicalVehicleMake,
  compactVehicleMakeKey,
  isVehicleMake,
  vehicleMakeKey,
  vehicleMakeLabel,
  vehicleMakeSlug,
} from '../../src/index.js';

describe('the canonical make list', () => {
  it('names every manufacturer once, by a key no other entry shares', () => {
    expect(new Set(VEHICLE_MAKES).size).toBe(VEHICLE_MAKES.length);
    const keys = VEHICLE_MAKES.map(vehicleMakeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('points every alias at a listed make, and never shadows a canonical name', () => {
    const canonicalKeys = new Set(VEHICLE_MAKES.map(vehicleMakeKey));
    for (const [alias, make] of Object.entries(VEHICLE_MAKE_ALIASES)) {
      expect(isVehicleMake(make)).toBe(true);
      expect(vehicleMakeKey(alias)).toBe(alias);
      expect(canonicalKeys.has(alias)).toBe(false);
    }
  });

  it('keeps every key unambiguous with its spaces removed', () => {
    const owners = new Map<string, string>();
    const entries: [string, string][] = [
      ...VEHICLE_MAKES.map((make): [string, string] => [vehicleMakeKey(make), make]),
      ...Object.entries(VEHICLE_MAKE_ALIASES),
    ];
    for (const [key, make] of entries) {
      const compact = compactVehicleMakeKey(key);
      expect(owners.get(compact) ?? make).toBe(make);
      owners.set(compact, make);
    }
  });

  it('includes the brands the marketplace already carries', () => {
    for (const make of ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'MG', 'Kia']) {
      expect(isVehicleMake(make)).toBe(true);
    }
  });
});

describe('resolving a typed or RC maker string', () => {
  it.each([
    ['Maruti Suzuki', 'Maruti Suzuki'],
    ['  maruti   suzuki ', 'Maruti Suzuki'],
    ['MARUTI SUZUKI INDIA LTD', 'Maruti Suzuki'],
    ['Maruti Suzuki India Pvt. Ltd.', 'Maruti Suzuki'],
    ['Maruti', 'Maruti Suzuki'],
    ['TATA MOTORS LTD', 'Tata'],
    ['Mahindra & Mahindra Ltd', 'Mahindra'],
    ['M&M', 'Mahindra'],
    ['TOYOTA KIRLOSKAR MOTOR PVT LTD', 'Toyota'],
    ['Hyundai Motor India Ltd', 'Hyundai'],
    ['KIA INDIA PVT LTD', 'Kia'],
    ['MG Motor India Pvt Ltd', 'MG'],
    ['mercedes benz', 'Mercedes-Benz'],
    ['MERCEDES-BENZ INDIA PVT LTD', 'Mercedes-Benz'],
    ['GENERAL MOTORS INDIA PVT LTD', 'Chevrolet'],
    ['Citroën', 'Citroen'],
    ['rolls royce', 'Rolls-Royce'],
    ['Force Motors Ltd', 'Force Motors'],
    ['hyundai', 'Hyundai'],
    ['HYUNDAI', 'Hyundai'],
    ['marutisuzuki', 'Maruti Suzuki'],
    ['maruthisuzuki', 'Maruti Suzuki'],
    ['Maruthi', 'Maruti Suzuki'],
    ['LANDROVER', 'Land Rover'],
    ['MercedesBenz', 'Mercedes-Benz'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalVehicleMake(input)).toBe(expected);
  });

  it.each([
    'SKODA AUTO VOLKSWAGEN INDIA PVT LTD',
    'JAGUAR LAND ROVER INDIA LTD',
    'Marutii',
    'Maru',
    'India',
    '',
  ])('names no brand for %j — ambiguous, misspelt or partial', (input) => {
    expect(canonicalVehicleMake(input)).toBeNull();
  });
});

describe('reading stored makes', () => {
  it('labels and keys a resolvable spelling as its brand, anything else as itself', () => {
    expect(vehicleMakeLabel('MARUTI SUZUKI INDIA LTD')).toBe('Maruti Suzuki');
    expect(vehicleMakeSlug('Maruti')).toBe('maruti-suzuki');
    expect(vehicleMakeLabel(' Hindustan Ambassador Co ')).toBe('Hindustan Ambassador Co');
    expect(vehicleMakeSlug('Hindustan Ambassador Co')).toBe('hindustan-ambassador-co');
  });
});

describe('the make field of UpdateVehicleInput', () => {
  it('arrives canonical when the input resolves, and as typed otherwise', () => {
    expect(UpdateVehicleInput.parse({ make: 'tata motors ltd' }).make).toBe('Tata');
    expect(UpdateVehicleInput.parse({ make: '  Some   Maker ' }).make).toBe('Some Maker');
    expect(UpdateVehicleInput.parse({ make: null }).make).toBeNull();
    expect(UpdateVehicleInput.safeParse({ make: '   ' }).success).toBe(false);
  });
});
