import { VEHICLE_WIZARD_STEPS } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_BASICS,
  validateBasics,
  type BasicsValue,
} from '../../../../src/features/vehicle/basics-fields.js';
import { validateDetails } from '../../../../src/features/vehicle/details-fields.js';

/**
 * The Basics step's client-side half, and — more importantly — the check that
 * it has not drifted from the server's.
 *
 * `VEHICLE_WIZARD_STEPS` is the single definition of which fields are required
 * where; the API derives `completeness.steps[]` from it and refuses to publish
 * without them. These tests fail the moment the browser's copy of that list
 * disagrees, which is the failure mode a duplicated rule always eventually has.
 */
const complete: BasicsValue = {
  makeId: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  modelId: '4a2c3d5e-6f70-4b8c-9dae-1f2a3b4c5d6e',
  variantId: '5b3d4e6f-7081-4c9d-aebf-2a3b4c5d6e7f',
  year: '2021',
  fuel: 'PETROL',
  transmission: 'MANUAL',
  bodyType: 'HATCHBACK',
};

describe('validateBasics', () => {
  it('passes a fully filled page', () => {
    expect(validateBasics(complete)).toEqual({});
  });

  it('requires every one of the seven', () => {
    // "Every field on this page is mandatory" is the whole rule for this step,
    // so the test is the whole rule too.
    const errors = validateBasics(EMPTY_BASICS);

    expect(Object.keys(errors).sort()).toEqual(
      ['bodyType', 'fuel', 'makeId', 'modelId', 'transmission', 'variantId', 'year'].sort(),
    );
  });

  it.each(Object.keys(complete) as (keyof BasicsValue)[])('requires %s', (field) => {
    expect(validateBasics({ ...complete, [field]: '' })[field]).toBeTruthy();
  });

  /** Variant was optional until the brief made it mandatory; it is the one to watch. */
  it('requires the variant, which used to be optional', () => {
    expect(validateBasics({ ...complete, variantId: '' }).variantId).toBe('Variant is required.');
  });

  it('treats whitespace as empty', () => {
    expect(validateBasics({ ...complete, year: '   ' }).year).toBeTruthy();
  });
});

describe('the client and the server require the same fields', () => {
  const stepFields = (key: string): string[] => {
    const step = VEHICLE_WIZARD_STEPS.find((entry) => entry.key === key);
    if (!step) throw new Error(`no wizard step named ${key}`);
    return [...step.fields];
  };

  it('Basics: the form validates exactly the contract’s basics fields', () => {
    expect(Object.keys(validateBasics(EMPTY_BASICS)).sort()).toEqual(stepFields('basics').sort());
  });

  it('Details: the form validates exactly the contract’s details fields', () => {
    const empty = {
      kmDriven: '',
      ownerNumber: '',
      colorId: '',
      rtoCode: '',
      insuranceType: '',
      insuranceValidTill: '',
      cityId: '',
      regNumberMasked: '',
      seats: '',
      airbags: '',
      features: '',
    };

    expect(Object.keys(validateDetails(empty)).sort()).toEqual(stepFields('details').sort());
  });
});
