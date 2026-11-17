import { describe, expect, it } from 'vitest';

import { fitFontSize } from '../src/lib/fit-text';

const OPTIONS = { max: 160, min: 80, width: 936, lines: 3 };

describe('fitFontSize', () => {
  it('keeps a short name at the maximum size', () => {
    expect(fitFontSize('Classic Cars', OPTIONS)).toBe(160);
  });

  it('shrinks a long name but never below the minimum', () => {
    const long = 'Sri Venkateswara Premium Pre-Owned Cars And Commercial Vehicles Vellore';
    const size = fitFontSize(long, OPTIONS);
    expect(size).toBeLessThan(160);
    expect(size).toBeGreaterThanOrEqual(80);
  });

  it('shrinks for one very long word', () => {
    expect(fitFontSize('Thiruvannamalaiautomobiles', { ...OPTIONS, min: 10 })).toBeLessThan(70);
  });

  it('returns the maximum for empty text', () => {
    expect(fitFontSize('   ', OPTIONS)).toBe(160);
  });
});
