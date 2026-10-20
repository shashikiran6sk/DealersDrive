import { describe, expect, it } from 'vitest';
import {
  CustomerDeactivationInput,
  CustomerReactivationInput,
  CustomerDeletionRequestInput,
  CUSTOMER_ACCOUNT_TEXT,
} from '../../src/customer-account.js';
import { CustomerSignInResponse } from '../../src/customer-auth.js';
import { NativeCustomerSignIn } from '../../src/native-auth.js';

describe('customer account controls', () => {
  it('requires affirmative choices and rejects caller-selected identity or privilege', () => {
    expect(CustomerDeactivationInput.parse({ confirmed: true })).toEqual({ confirmed: true });
    for (const body of [
      { confirmed: false },
      { confirmed: true, userId: 'foreign' },
      { confirmed: true, scope: 'ADMIN' },
    ])
      expect(CustomerDeactivationInput.safeParse(body).success).toBe(false);
    expect(
      CustomerReactivationInput.safeParse({ confirmed: true, reactivationToken: 'proof' }).success,
    ).toBe(true);
    expect(
      CustomerReactivationInput.safeParse({ confirmed: false, reactivationToken: 'proof' }).success,
    ).toBe(false);
    expect(
      CustomerReactivationInput.safeParse({ confirmed: true, reactivationToken: 'x'.repeat(2049) })
        .success,
    ).toBe(false);
  });
  it('binds website intake to an expected owner and bounded text without claiming erasure', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(
      CustomerDeletionRequestInput.parse({
        confirmed: true,
        clientRequestId: id,
        expectedAccountId: id,
      }).message,
    ).toBe('');
    expect(
      CustomerDeletionRequestInput.safeParse({
        confirmed: true,
        clientRequestId: id,
        expectedAccountId: id,
        message: 'x'.repeat(4001),
      }).success,
    ).toBe(false);
    expect(CUSTOMER_ACCOUNT_TEXT.deletionReceived('DD-1')).toContain('not confirmation');
  });
  it('keeps legacy signed/name responses valid and separates reactivation from credentials', () => {
    expect(
      CustomerSignInResponse.parse({
        status: 'NAME_REQUIRED',
        customer: null,
        signUpToken: 'proof',
        expiresAt: '2030-01-01T00:00:00.000Z',
        phoneDisplay: '+91 …',
      }).status,
    ).toBe('NAME_REQUIRED');
    const result = NativeCustomerSignIn.parse({
      status: 'REACTIVATION_REQUIRED',
      reactivationToken: 'proof',
      expiresAt: '2030-01-01T00:00:00.000Z',
      phoneDisplay: '+91 …',
      fullName: 'Customer',
    });
    expect(result).not.toHaveProperty('credential');
    expect(result).not.toHaveProperty('signUpToken');
  });
});
