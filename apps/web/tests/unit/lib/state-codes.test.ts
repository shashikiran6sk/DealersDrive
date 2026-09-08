import { describe, expect, it } from 'vitest';

import { stateCode } from '@/lib/state-codes';

/**
 * The RTO code a state header wears as a plate.
 *
 * The only behaviour worth pinning is the **fallback**: `state` is free text a
 * dealership typed into an onboarding form, so anything can arrive, and a wrong
 * two-letter code on something shaped like a number plate is worse than no code
 * at all. `null` is the answer, and the heading renders without a plate.
 */
describe('stateCode', () => {
  it('answers with the code on the plates that state issues', () => {
    expect(stateCode('Tamil Nadu')).toBe('TN');
    expect(stateCode('Karnataka')).toBe('KA');
    expect(stateCode('Puducherry')).toBe('PY');
  });

  /** Typed by a human into a text field, so case and punctuation vary. */
  it('folds case, spacing and punctuation', () => {
    for (const written of ['TAMIL NADU', 'tamil  nadu', 'Tamil-Nadu', ' Tamil Nadu ']) {
      expect(stateCode(written)).toBe('TN');
    }
  });

  it('knows the names people actually write', () => {
    expect(stateCode('Orissa')).toBe('OD');
    expect(stateCode('Pondicherry')).toBe('PY');
    expect(stateCode('NCT of Delhi')).toBe('DL');
  });

  it('returns null rather than guessing', () => {
    expect(stateCode('Atlantis')).toBeNull();
    expect(stateCode('')).toBeNull();
    expect(stateCode(null)).toBeNull();
  });
});
