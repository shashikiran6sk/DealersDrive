import { describe, expect, it } from 'vitest';
import {
  ProgressiveRegistrationInput,
  ProgressiveAssistedRegistrationInput,
  ProgressiveVerificationPlan,
} from '../../src/progressive-onboarding.js';
const registration = {
  fullName: 'Synthetic Representative',
  phone: '9000100001',
  legalName: 'Synthetic Business',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  declaration: true,
};
const plan = {
  classification: 'INTERMEDIARY_REVIEWED',
  classificationReference: 'Protected synthetic applicability review.',
  requiredDocuments: ['ADDRESS_PROOF'],
  gstRequirement: 'NOT_REQUIRED_REVIEWED',
  gstReference: 'Protected synthetic tax review.',
  representativeIdentityReference: 'Protected synthetic identity review.',
  representativeAuthorityReference: 'Protected synthetic authority review.',
  businessExistenceReference: 'Protected synthetic business review.',
  regulatoryOutcome: 'NOT_APPLICABLE_REVIEWED',
  regulatoryReference: 'Protected synthetic regulation review.',
};
describe('progressive registration contracts', () => {
  it('accepts essential registration without tax, marketing or document data', () =>
    expect(ProgressiveRegistrationInput.safeParse(registration).success).toBe(true));
  it.each([undefined, false, null])('rejects missing authorization consent %s', (declaration) =>
    expect(ProgressiveRegistrationInput.safeParse({ ...registration, declaration }).success).toBe(
      false,
    ),
  );
  it.each(['email', 'userId', 'status'])('rejects forged identity/activation field %s', (key) =>
    expect(
      ProgressiveRegistrationInput.safeParse({ ...registration, [key]: 'forged' }).success,
    ).toBe(false),
  );
  it('normalizes assisted email but does not accept owner IDs', () => {
    const { fullName: _name, phone: _phone, ...base } = registration;
    const input = {
      ...base,
      contactName: 'Synthetic Rep',
      phoneTicket: 'synthetic-ticket',
      email: ' REP@EXAMPLE.TEST ',
    };
    expect(ProgressiveAssistedRegistrationInput.parse(input).email).toBe('rep@example.test');
    expect(
      ProgressiveAssistedRegistrationInput.safeParse({ ...input, ownerId: 'forged' }).success,
    ).toBe(false);
  });
  it('requires actual case references for business classification', () =>
    expect(
      ProgressiveVerificationPlan.safeParse({ ...plan, classificationReference: '' }).success,
    ).toBe(false));
  it('requires reviewed authorization for an applicable vehicle dealer', () =>
    expect(
      ProgressiveVerificationPlan.safeParse({
        ...plan,
        classification: 'REGISTERED_VEHICLE_DEALER',
      }).success,
    ).toBe(false));
  it('requires GST evidence only when the reviewed policy requires it', () => {
    expect(ProgressiveVerificationPlan.safeParse(plan).success).toBe(true);
    expect(
      ProgressiveVerificationPlan.safeParse({ ...plan, gstRequirement: 'REQUIRED' }).success,
    ).toBe(false);
    expect(
      ProgressiveVerificationPlan.safeParse({
        ...plan,
        gstRequirement: 'REQUIRED',
        requiredDocuments: ['GST_CERTIFICATE'],
      }).success,
    ).toBe(true);
  });
  it.each([
    { requiredDocuments: [] },
    { requiredDocuments: ['ADDRESS_PROOF', 'ADDRESS_PROOF'] },
    { requiredDocuments: ['AADHAAR'] },
  ])('rejects invalid/unnecessary document collection %j', ({ requiredDocuments }) =>
    expect(ProgressiveVerificationPlan.safeParse({ ...plan, requiredDocuments }).success).toBe(
      false,
    ),
  );
});
