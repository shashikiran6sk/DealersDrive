import { describe, expect, it } from 'vitest';

import { availableLabel, featuredIndex, pricesAsOf } from '../src/copy/copy';

describe('copy', () => {
  it('pluralises the available label in English', () => {
    expect(availableLabel(1).en).toBe('car available');
    expect(availableLabel(19).en).toBe('cars available');
    expect(availableLabel(19).ta).toBe('கார்கள் விற்பனைக்கு');
  });

  it('pads the featured index', () => {
    expect(featuredIndex(2, 4)).toBe('02 / 04');
  });

  it('dates the prices in both languages', () => {
    expect(pricesAsOf(new Date(Date.UTC(2026, 10, 4)))).toEqual({
      en: 'Prices as of 4 Nov 2026',
      ta: 'விலைகள் 4 நவம்பர் 2026 நிலவரப்படி',
    });
  });
});
