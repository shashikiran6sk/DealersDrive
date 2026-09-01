import { describe, expect, it } from 'vitest';

import {
  detailsPatch,
  validateDetails,
  type DetailsValue,
} from '../../../../src/features/vehicle/details-fields.js';

/**
 * The Details step's client-side half.
 *
 * It exists for the *messages* — the API runs the same rules and is what
 * actually enforces them (`VEHICLE_WIZARD_STEPS`). So the property worth
 * pinning is not that these checks exist but that they agree with the server:
 * a client that is stricter blocks a dealer for no reason, and a client that is
 * laxer sends a request that 400s with a message nobody wired to a field.
 */
const complete: DetailsValue = {
  kmDriven: '42000',
  ownerNumber: '1',
  colorId: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  rtoCode: 'TN-23',
  insuranceType: 'COMPREHENSIVE',
  insuranceValidTill: '2027-03-01',
  cityId: '4a2c3d5e-6f70-4b8c-9dae-1f2a3b4c5d6e',
  regNumberMasked: 'TN 09 BX 1234',
  seats: '',
  airbags: '',
  features: '',
};

describe('validateDetails', () => {
  it('passes a fully filled page', () => {
    expect(validateDetails(complete)).toEqual({});
  });

  /** The eight the brief makes mandatory, and exactly those. */
  it.each([
    ['kmDriven', 'KMs driven'],
    ['ownerNumber', 'Number of owners'],
    ['colorId', 'Colour'],
    ['rtoCode', 'RTO'],
    ['insuranceType', 'Insurance'],
    ['insuranceValidTill', 'Insurance valid till'],
    ['cityId', 'Location'],
    ['regNumberMasked', 'Registration number'],
  ] as const)('requires %s', (field, label) => {
    const errors = validateDetails({ ...complete, [field]: '' });

    expect(errors[field]).toBe(`${label} is required.`);
  });

  it('leaves seats, airbags and features optional', () => {
    // These are the three the server also lets through as `null`; the two lists
    // have to match or "optional" means something different on each side.
    expect(validateDetails({ ...complete, seats: '', airbags: '', features: '' })).toEqual({});
  });

  it('reports every gap at once, not the first one', () => {
    // A dealer fixing one field at a time, reloading between each, is the
    // experience this avoids.
    const errors = validateDetails({ ...complete, kmDriven: '', colorId: '', rtoCode: '' });

    expect(Object.keys(errors).sort()).toEqual(['colorId', 'kmDriven', 'rtoCode']);
  });

  it.each(['TN 09 BX 1234', 'TN09BX1234', 'tn-09-bx-1234', '24 BH 1234 AB'])(
    'accepts %s as a registration number',
    (plate) => {
      expect(validateDetails({ ...complete, regNumberMasked: plate })).toEqual({});
    },
  );

  it.each(['asdf', '1234', 'TN', 'TN09BX'])('refuses %s as a registration number', (plate) => {
    // A mandatory field that accepts anything is required in name only.
    expect(validateDetails({ ...complete, regNumberMasked: plate }).regNumberMasked).toBeTruthy();
  });

  it('refuses an odometer reading that is not a plausible number', () => {
    expect(validateDetails({ ...complete, kmDriven: '-5' }).kmDriven).toBeTruthy();
    expect(validateDetails({ ...complete, kmDriven: '2000000' }).kmDriven).toBeTruthy();
    expect(validateDetails({ ...complete, kmDriven: '0' })).toEqual({});
  });

  it('refuses an unparseable insurance date', () => {
    expect(
      validateDetails({ ...complete, insuranceValidTill: 'next tuesday' }).insuranceValidTill,
    ).toBeTruthy();
  });
});

describe('detailsPatch', () => {
  it('sends only the fields this step owns', () => {
    // An untouched step must not blank another's — which is what makes going
    // back to Basics and forward again non-destructive.
    const patch = detailsPatch(complete);

    expect(Object.keys(patch).sort()).toEqual([
      'airbags',
      'cityId',
      'colorId',
      'features',
      'insuranceType',
      'insuranceValidTill',
      'kmDriven',
      'ownerNumber',
      'regNumberMasked',
      'rtoCode',
      'seats',
    ]);
  });

  it('turns the bare date input into the offset datetime the contract wants', () => {
    expect(detailsPatch(complete).insuranceValidTill).toBe('2027-03-01T00:00:00.000Z');
  });

  it('nulls the two genuinely optional numbers when they are cleared', () => {
    // Only these may be blanked; every required field is simply not sent when
    // empty, because the schema refuses a `null` for one.
    const patch = detailsPatch({ ...complete, seats: '', airbags: '' });

    expect(patch.seats).toBeNull();
    expect(patch.airbags).toBeNull();
  });

  it('keeps seats and airbags when they are given', () => {
    expect(detailsPatch({ ...complete, seats: '7', airbags: '6' })).toMatchObject({
      seats: 7,
      airbags: 6,
    });
  });

  it('splits features on commas and drops the blanks', () => {
    expect(detailsPatch({ ...complete, features: 'Sunroof, , Alloy wheels ,' })).toMatchObject({
      features: ['Sunroof', 'Alloy wheels'],
    });
  });

  it('omits a required field rather than sending an empty string for it', () => {
    const patch = detailsPatch({ ...complete, rtoCode: '', colorId: '' });

    expect(patch).not.toHaveProperty('rtoCode');
    expect(patch).not.toHaveProperty('colorId');
  });
});
