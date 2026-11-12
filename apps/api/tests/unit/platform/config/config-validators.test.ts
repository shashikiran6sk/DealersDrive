import { describe, expect, it } from 'vitest';

import {
  CONFIG_DEFAULTS,
  CONFIG_VALIDATORS,
} from '../../../../src/platform/config/platform-config.js';

describe('billing configuration an admin can save', () => {
  it('accepts every default', () => {
    for (const entry of CONFIG_DEFAULTS) {
      expect(CONFIG_VALIDATORS[entry.key]?.(entry.value) ?? null, entry.key).toBeNull();
    }
  });

  it('refuses a malformed pack list and an impossible credit cost', () => {
    expect(CONFIG_VALIDATORS['billing.creditPacks']?.(['5 for 2000'])).toMatch(
      /credits=pricePaise/,
    );
    expect(CONFIG_VALIDATORS['billing.listingCredits']?.(0)).toMatch(/whole number/);
    expect(CONFIG_VALIDATORS['billing.photoshootCredits']?.(1.5)).toMatch(/whole number/);
    expect(CONFIG_VALIDATORS['billing.photoshootCredits']?.(0)).toBeNull();
  });

  it('ships both features switched off, so deploying changes nothing', () => {
    const flag = (key: string) => CONFIG_DEFAULTS.find((entry) => entry.key === key)?.value;
    expect(flag('feature.dealerPhotos')).toBe(false);
    expect(flag('feature.listingCredits')).toBe(false);
  });
});
