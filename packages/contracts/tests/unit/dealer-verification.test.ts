import { describe, expect, it } from 'vitest';
import {
  DealerVerificationDecisionInput,
  DEALER_VERIFICATION_TRANSITIONS,
  isDealerVerified,
} from '../../src/dealer-verification.js';
const assessment = {
  representativeIdentity: 'Reviewed synthetic identity case 1',
  representativeAuthority: 'Representative authority case 1',
  businessExistence: 'Business registry review case 1',
  contactValidation: 'Verified synthetic contact case 1',
  businessType: 'REGISTERED_VEHICLE_DEALER',
  classificationEvidence: 'Registered dealer classification case 1',
  regulatoryOutcome: 'CHECKED_VALID',
  regulatoryEvidence: 'Reviewed authorization case 1',
  gstOutcome: 'NOT_REQUIRED_REVIEWED',
  gstEvidence: 'Tax applicability reviewed case 1',
};
describe('genuine dealer verification contracts', () => {
  it('requires documented performed checks and refuses arbitrary self-assigned fields', () => {
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        assessment,
      }).success,
    ).toBe(true);
    expect(
      DealerVerificationDecisionInput.safeParse({ expectedVersion: 1, status: 'VERIFIED' }).success,
    ).toBe(false);
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        assessment: { ...assessment, representativeIdentity: 'checked' },
      }).success,
    ).toBe(false);
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 1,
        status: 'VERIFIED',
        assessment,
        isVerified: true,
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
  it('refuses evidence on non-verification transitions and invalid/stale-version shapes', () => {
    expect(
      DealerVerificationDecisionInput.safeParse({
        expectedVersion: 0,
        status: 'IN_REVIEW',
        assessment,
      }).success,
    ).toBe(false);
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
