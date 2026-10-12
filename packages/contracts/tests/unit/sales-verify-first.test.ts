import { describe, expect, it } from 'vitest';

import {
  CreateAssistedDealerInput,
  SalesEmailCodeInput,
  SalesEmailVerifyInput,
  UpdateAssistedDealerInput,
  VerifyAssistedDealerInput,
} from '../../src/sales.js';

const business = {
  contactName: 'Synthetic Owner',
  legalName: 'Synthetic Motors',
  addressLine: 'Synthetic Street',
  city: 'Katpadi',
  state: 'Tamil Nadu',
  district: 'Vellore',
  pincode: '632001',
  mapsUrl: 'https://www.google.com/maps?q=12.98,79.15',
  specialities: ['Finance'],
};

describe('verify-first assisted onboarding', () => {
  it('creates a dealership only from two tickets, never a typed email or number', () => {
    const tickets = { phoneTicket: 'phone-ticket', emailTicket: 'email-ticket' };
    expect(CreateAssistedDealerInput.safeParse({ ...business, ...tickets }).success).toBe(true);
    expect(
      CreateAssistedDealerInput.safeParse({ ...business, phoneTicket: 'phone-ticket' }).success,
    ).toBe(false);
    expect(
      CreateAssistedDealerInput.safeParse({ ...business, ...tickets, email: 'a@example.test' })
        .success,
    ).toBe(false);
  });

  it('never edits the verified contact', () => {
    expect(UpdateAssistedDealerInput.safeParse({ contactName: 'New Name' }).success).toBe(true);
    expect(UpdateAssistedDealerInput.safeParse({ email: 'a@example.test' }).success).toBe(false);
    expect(UpdateAssistedDealerInput.safeParse({ emailTicket: 'x' }).success).toBe(false);
  });

  it('takes a real address for a code, and a six-digit code', () => {
    expect(SalesEmailCodeInput.safeParse({ email: 'owner@example.test' }).success).toBe(true);
    expect(SalesEmailCodeInput.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(SalesEmailVerifyInput.safeParse({ challenge: 'c', code: '482915' }).success).toBe(true);
    for (const code of ['48291', '4829150', 'abcdef']) {
      expect(SalesEmailVerifyInput.safeParse({ challenge: 'c', code }).success).toBe(false);
    }
  });

  it('verifies an existing dealership with both tickets and nothing else', () => {
    expect(
      VerifyAssistedDealerInput.safeParse({ phoneTicket: 'p', emailTicket: 'e' }).success,
    ).toBe(true);
    expect(
      VerifyAssistedDealerInput.safeParse({ phoneTicket: 'p', emailTicket: 'e', dealerId: 'x' })
        .success,
    ).toBe(false);
  });
});
