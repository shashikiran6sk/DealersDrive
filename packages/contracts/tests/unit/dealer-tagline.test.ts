import { describe, expect, it } from 'vitest';
import {
  DealerTaglineInput,
  OnboardingInput,
  UpdateDealerInput,
  CreateAssistedDealerInput,
  DealerSelfUpdateInput,
} from '../../src/index.js';
const onboarding = {
  fullName: 'Synthetic Representative',
  phone: '9000051111',
  legalName: 'Synthetic Dealer',
  addressLine: 'Synthetic Street',
  city: 'Katpadi',
  state: 'Tamil Nadu',
  district: 'Vellore',
  pincode: '632001',
  mapsUrl: 'https://www.google.com/maps?q=12.98,79.15',
  specialities: ['Finance'],
};
describe('optional dealer tagline', () => {
  it.each([undefined, null, '', '   ', '\t\n'])('accepts absence or blank input %s', (value) => {
    expect(DealerTaglineInput.parse(value)).toBe(value === undefined ? undefined : null);
    expect(OnboardingInput.safeParse({ ...onboarding, tagline: value }).success).toBe(true);
    expect(UpdateDealerInput.safeParse({ tagline: value }).success).toBe(true);
    expect(DealerSelfUpdateInput.safeParse({ tagline: value }).success).toBe(true);
    const { fullName: _name, phone: _phone, ...business } = onboarding;
    expect(
      CreateAssistedDealerInput.safeParse({
        ...business,
        contactName: 'Synthetic Representative',
        email: 'synthetic@example.test',
        phoneTicket: 'fixture-ticket',
        tagline: value,
      }).success,
    ).toBe(true);
  });
  it.each(['x', 'Short', 'a'.repeat(200)])('accepts bounded nonempty text', (value) => {
    expect(DealerTaglineInput.parse(` ${value} `)).toBe(value);
  });
  it.each(['a'.repeat(201), 123, {}, false])('rejects overlong or non-text input', (value) => {
    expect(DealerTaglineInput.safeParse(value).success).toBe(false);
  });
  it('preserves omitted patch semantics separately from explicit clearing', () => {
    expect(UpdateDealerInput.parse({})).not.toHaveProperty('tagline');
    expect(UpdateDealerInput.parse({ tagline: '' })).toEqual({ tagline: null });
  });
});
