import { describe, expect, it } from 'vitest';

import { cyclic, sampleAt } from '../src/lib/pick';

describe('sampleAt', () => {
  it('reads a sample and treats out-of-range as silence', () => {
    const samples = new Float32Array([0.5]);
    expect(sampleAt(samples, 0)).toBe(0.5);
    expect(sampleAt(samples, 4)).toBe(0);
  });
});

describe('cyclic', () => {
  it('wraps in both directions and falls back on an empty list', () => {
    expect(cyclic(['a', 'b', 'c'], 4, 'z')).toBe('b');
    expect(cyclic(['a', 'b', 'c'], -1, 'z')).toBe('c');
    expect(cyclic([], 2, 'z')).toBe('z');
  });
});
