import { describe, expect, it } from 'vitest';

import { countUp, drift, enter, exit, wipe } from '../src/lib/motion';

describe('motion', () => {
  it('enter rises from 0 to 1 after its delay', () => {
    expect(enter(0, 30, { delay: 5 })).toBe(0);
    expect(enter(60, 30, { delay: 5 })).toBeCloseTo(1, 2);
  });

  it('enter honours a fixed duration', () => {
    expect(enter(16, 30, { durationInFrames: 16 })).toBeCloseTo(1, 1);
  });

  it('exit is 0 until the last frames, then 1 at the end', () => {
    expect(exit(10, 75, 10)).toBe(0);
    expect(exit(75, 75, 10)).toBe(1);
  });

  it('wipe covers fully at the start and clears after its length', () => {
    expect(wipe(0)).toBe(1);
    expect(wipe(20)).toBe(0);
  });

  it('drift moves linearly and clamps', () => {
    expect(drift(50, 100, 0, 10)).toBe(5);
    expect(drift(200, 100, 0, 10)).toBe(10);
  });

  it('countUp lands exactly on the target', () => {
    expect(countUp(0, 19, 10, 30)).toBe(0);
    expect(countUp(40, 19, 10, 30)).toBe(19);
  });
});
