import { describe, expect, it } from 'vitest';
import {
  DealerVerificationDecisionInput,
  DEALER_VERIFICATION_TRANSITIONS,
  isDealerVerified,
} from '../../src/dealer-verification.js';

describe('genuine dealer verification contracts', () => {
  it('takes a status and refuses arbitrary self-assigned fields', () => {
    expect(
      DealerVerificationDecisionInput.safeParse({ expectedVersion: 1, status: 'VERIFIED' }).success,
    ).toBe(true);
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        reason: 'Documents and contact details reviewed.',
      }).success,
    ).toBe(true);
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        isVerified: true,
      }).success,
    ).toBe(false);
  });

  it('no longer accepts the free-text assessment it once required (#299)', () => {
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        assessment: { representativeIdentity: 'Reviewed synthetic identity case 1' },
      }).success,
    ).toBe(false);
  });

  it.each(['REJECTED', 'REVOKED'])('requires a reason for %s', (status) => {
    expect(DealerVerificationDecisionInput.safeParse({ expectedVersion: 1, status }).success).toBe(
      false,
    );
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status,
        reason: 'Documented synthetic decision',
      }).success,
    ).toBe(true);
  });

  it('keeps approval, verification and revocation separate', () => {
    expect(isDealerVerified({ status: 'ACTIVE' })).toBe(false);
    expect(isDealerVerified({ status: 'ACTIVE', verificationStatus: 'VERIFIED' })).toBe(true);
    expect(isDealerVerified({ status: 'SUSPENDED', verificationStatus: 'VERIFIED' })).toBe(false);
    expect(isDealerVerified({ status: 'ACTIVE', verificationStatus: 'REVOKED' })).toBe(false);
    expect(DEALER_VERIFICATION_TRANSITIONS.NOT_VERIFIED).not.toContain('VERIFIED');
    expect(DEALER_VERIFICATION_TRANSITIONS.VERIFIED).toEqual(['REVOKED']);
  });

  it('refuses invalid and stale-version shapes', () => {
    expect(
      DealerVerificationDecisionInput.safeParse({ expectedVersion: -1, status: 'IN_REVIEW' })
        .success,
    ).toBe(false);
    expect(
      DealerVerificationDecisionInput.safeParse({ expectedVersion: 0, status: 'NOT_VERIFIED' })
        .success,
    ).toBe(false);
  });
});
