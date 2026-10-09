import { describe, expect, it } from 'vitest';
import {
  AddServiceDistrictInput,
  GovernmentSourceUrl,
  ServiceLocationSettings,
  canonicalDistrictFilterSlug,
} from '../../src/service-locations.js';

describe('service location contracts', () => {
  it.each(['https://vellore.nic.in/', 'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/'])(
    'accepts authoritative HTTPS sources %s',
    (value) => {
      expect(GovernmentSourceUrl.safeParse(value).success).toBe(true);
    },
  );
  it.each([
    'not a url',
    'https://',
    '',
    'http://vellore.nic.in/',
    'https://nic.in.evil.test/',
    'https://example.test/',
    'https://user:password@vellore.nic.in/',
  ])('rejects unsafe or non-government sources %s', (value) => {
    expect(GovernmentSourceUrl.safeParse(value).success).toBe(false);
  });
  it('requires an explicit source review and preserves canonical names within length limits', () => {
    const input = {
      stateId: 'IN-TN',
      name: '  Vellore  ',
      sourceUrl: 'https://vellore.nic.in/',
      sourceReviewed: true,
    };
    expect(AddServiceDistrictInput.parse(input).name).toBe('Vellore');
    expect(AddServiceDistrictInput.safeParse({ ...input, sourceReviewed: false }).success).toBe(
      false,
    );
    expect(AddServiceDistrictInput.safeParse({ ...input, name: '<script>' }).success).toBe(false);
  });
  it('requires a positive version and boolean switches rather than accepting extra administrative data', () => {
    expect(
      ServiceLocationSettings.safeParse({
        expectedVersion: 1,
        active: true,
        onboardingEnabled: false,
      }).success,
    ).toBe(true);
    expect(
      ServiceLocationSettings.safeParse({
        expectedVersion: 0,
        active: true,
        onboardingEnabled: false,
      }).success,
    ).toBe(false);
    expect(
      ServiceLocationSettings.safeParse({
        expectedVersion: 1,
        active: 'true',
        onboardingEnabled: false,
      }).success,
    ).toBe(false);
    expect(
      ServiceLocationSettings.safeParse({
        expectedVersion: 1,
        active: true,
        onboardingEnabled: false,
        actorId: 'forged',
      }).success,
    ).toBe(false);
  });
  it.each([
    ['tirupattur', 'tirupathur'],
    ['pudukkottai', 'pudukottai'],
    ['nilgiris', 'the-nilgiris'],
    ['vellore', 'vellore'],
    ['future-district', 'future-district'],
  ])('preserves legacy filter links %s', (old, canonical) => {
    expect(canonicalDistrictFilterSlug(old)).toBe(canonical);
  });
});
