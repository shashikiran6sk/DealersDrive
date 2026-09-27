import { describe, expect, it } from 'vitest';

import {
  normaliseVehicleColor,
  VEHICLE_COLOR_LABELS,
  VEHICLE_COLOR_WORDS,
  VehicleColor,
} from '../../src/enums.js';
import { UpdateVehicleInput } from '../../src/vehicle.js';

/**
 * Generic colours (**R52**): one list the form offers, the API accepts and the
 * search filters on — and a conservative reading of what was typed before.
 */
describe('the colour families', () => {
  it('are twelve, the last of them Other, each with a label', () => {
    expect(VehicleColor.options).toEqual([
      'BLACK',
      'WHITE',
      'GREY',
      'SILVER',
      'RED',
      'BLUE',
      'GREEN',
      'BROWN',
      'BEIGE',
      'YELLOW',
      'ORANGE',
      'OTHER',
    ]);
    expect(Object.keys(VEHICLE_COLOR_LABELS)).toEqual(VehicleColor.options);
    expect(Object.values(VEHICLE_COLOR_LABELS)).not.toContain('Pearl White');
  });

  it('name every family but Other by at least one word', () => {
    for (const family of VehicleColor.options.filter((value) => value !== 'OTHER')) {
      expect(VEHICLE_COLOR_WORDS[family].length).toBeGreaterThan(0);
    }
  });

  it('are what a vehicle may be saved with — and nothing else', () => {
    expect(UpdateVehicleInput.safeParse({ color: 'SILVER' }).success).toBe(true);
    expect(UpdateVehicleInput.safeParse({ color: null }).success).toBe(true);
    for (const color of ['Silver', 'Fiery Red', 'Pearl White', 'MAGENTA', '']) {
      expect(UpdateVehicleInput.safeParse({ color }).success).toBe(false);
    }
  });
});

describe('reading a colour somebody typed', () => {
  it.each([
    ['Pearl White', 'WHITE'],
    ['Phantom Black', 'BLACK'],
    ['Magma Grey', 'GREY'],
    ['Titan Gray', 'GREY'],
    ['Silky Silver', 'SILVER'],
    ['Fiery Red', 'RED'],
    ['Maroon', 'RED'],
    ['Midnight Blue', 'BLUE'],
    ['Navy Blue', 'BLUE'],
    ['Racing Green', 'GREEN'],
    ['Pearl Brown', 'BROWN'],
    ['Beige', 'BEIGE'],
    ['Yellow', 'YELLOW'],
    ['Sunset Orange', 'ORANGE'],
    ['white', 'WHITE'],
    ['OTHER', 'OTHER'],
  ])('reads %s as %s', (typed, family) => {
    expect(normaliseVehicleColor(typed)).toBe(family);
  });

  it.each(['Deep Forest', 'Red with black roof', 'Blackberry', 'Greyish', 'Champagne'])(
    'files %s under Other rather than guessing',
    (typed) => {
      expect(normaliseVehicleColor(typed)).toBe('OTHER');
    },
  );

  it('reads blank as no colour', () => {
    expect(normaliseVehicleColor('   ')).toBeNull();
    expect(normaliseVehicleColor(null)).toBeNull();
    expect(normaliseVehicleColor(undefined)).toBeNull();
  });
});
