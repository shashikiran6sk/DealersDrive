import { describe, expect, it } from 'vitest';

import { matchDistricts } from '@/components/forms/service-location-fields/utils';

const district = (name: string) => ({
  id: `IN-TN-${name}`,
  stateId: 'IN-TN',
  name,
  sourceUrl: 'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',
  active: true,
  onboardingEnabled: true,
  photographyAvailable: true,
  version: 1,
});
const all = ['Kancheepuram', 'Thoothukudi', 'Tiruchirappalli', 'The Nilgiris', 'Vellore'].map(
  district,
);
const names = (search: string) => matchDistricts(all, search).map((item) => item.name);

describe('matchDistricts', () => {
  it('matches part of a government display name, ignoring case and outer spaces', () => {
    expect(names('  tiruchi ')).toEqual(['Tiruchirappalli']);
    expect(names('NILGIRIS')).toEqual(['The Nilgiris']);
  });

  it('maps reviewed legacy names to the canonical district', () => {
    expect(names('Trichy')).toEqual(['Tiruchirappalli']);
    expect(names('Tuticorin')).toEqual(['Thoothukudi']);
    expect(names('kanchipuram')).toEqual(['Kancheepuram']);
  });

  it('lists every district for an empty search and nothing for an unknown name', () => {
    expect(names('')).toHaveLength(all.length);
    expect(names('Bengaluru')).toEqual([]);
  });
});
