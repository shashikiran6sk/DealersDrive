import type { Vehicle } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  approvalBlockers,
  type ApprovalState,
} from '../../../../src/modules/moderation/moderation.approval.js';

const COMPLETE = {
  registrationNumber: 'KA01AB1234',
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX(O)',
  manufacturingYear: 2023,
  registrationYear: 2023,
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  bodyType: 'SUV',
  kilometersDriven: 22_400,
  ownerCount: 1,
  color: 'White',
  pricePaise: 145_000_000n,
  city: 'Vellore',
  insuranceType: 'COMPREHENSIVE',
  priceNegotiability: 'FIXED',
} as unknown as Vehicle;

function state(overrides: Partial<ApprovalState> = {}): ApprovalState {
  return {
    dealerStatus: 'ACTIVE',
    dealerCity: 'Vellore',
    vehicle: COMPLETE,
    checkedKeys: [
      'REGISTRATION',
      'MAKE_MODEL',
      'VARIANT',
      'YEAR',
      'ODOMETER',
      'OWNERSHIP',
      'PRICING',
    ],
    imageCount: 6,
    hasPrimary: true,
    minImages: 6,
    ...overrides,
  };
}

function codes(value: ApprovalState): string[] {
  return approvalBlockers(value).map((blocker) => blocker.code);
}

describe('approvalBlockers', () => {
  it('finds nothing in the way of a listing that meets every rule', () => {
    expect(codes(state())).toEqual([]);
  });

  it('names each unmet rule, in the order a moderator works through them', () => {
    expect(
      codes(
        state({
          dealerStatus: 'SUSPENDED',
          vehicle: { ...COMPLETE, color: null } as unknown as Vehicle,
          checkedKeys: [],
          imageCount: 2,
          hasPrimary: false,
        }),
      ),
    ).toEqual([
      'DEALER_NOT_ACTIVE',
      'VEHICLE_INCOMPLETE',
      'CHECKS_INCOMPLETE',
      'TOO_FEW_IMAGES',
      'NO_PRIMARY_IMAGE',
    ]);
  });

  it('counts the checks and the images in its messages', () => {
    const blockers = approvalBlockers(state({ checkedKeys: ['YEAR'], imageCount: 1 }));
    expect(blockers.map((blocker) => blocker.message)).toEqual([
      '6 verification checks are still unticked.',
      '1 of the 6 images needed is uploaded.',
    ]);
    expect(
      approvalBlockers(
        state({
          checkedKeys: ['REGISTRATION', 'MAKE_MODEL', 'VARIANT', 'YEAR', 'ODOMETER', 'OWNERSHIP'],
        }),
      )[0]?.message,
    ).toBe('1 verification check is still unticked.');
  });

  it('reads the minimum it is given rather than a constant', () => {
    expect(codes(state({ imageCount: 3, minImages: 3 }))).toEqual([]);
    expect(codes(state({ imageCount: 6, minImages: 8 }))).toEqual(['TOO_FEW_IMAGES']);
  });
});
