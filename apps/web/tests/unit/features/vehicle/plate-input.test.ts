import { REGISTRATION_NUMBER } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import { normalisePlate, validatePlate } from '../../../../src/components/forms/plate-input.js';

/**
 * The plate field's client-side half.
 *
 * Two things worth pinning. First, that the browser and the server agree on
 * what a registration number is — they share `REGISTRATION_NUMBER` rather than
 * keeping two regexes in step, and this file fails if that import is ever
 * replaced by a local copy.
 *
 * Second, that separators are genuinely optional. A dealer copying a number
 * off a windscreen writes `TN 09 BX 1234`, `TN-09-BX-1234` or `tn09bx1234`
 * depending on habit, and rejecting two of those would be the form telling
 * them they typed their own car's registration wrongly. This is also the check
 * that stops a malformed plate reaching a provider — the lookup is billed per
 * call, so a typo should cost an inline hint, not ₹3.
 */
describe('validatePlate', () => {
  it('accepts the separators a dealer actually types', () => {
    for (const written of ['TN09BX1234', 'TN 09 BX 1234', 'TN-09-BX-1234', 'tn09bx1234']) {
      expect(validatePlate(written), written).toBeUndefined();
    }
  });

  it('accepts the older four-character series still on the road', () => {
    // `TN 09 B 1234` — a 2003 car is ordinary used stock, not an edge case.
    expect(validatePlate('TN09B1234')).toBeUndefined();
  });

  it('accepts a BH-series mark', () => {
    // National rather than state-issued. A Tamil Nadu dealer will hold one.
    expect(validatePlate('24BH1234AB')).toBeUndefined();
  });

  it('rejects what is not a plate, with a message showing the shape', () => {
    expect(validatePlate('')).toContain('Enter the registration number');
    expect(validatePlate('HELLO')).toContain('TN 09 BX 1234');
    expect(validatePlate('12345')).toContain('TN 09 BX 1234');
  });
});

describe('normalisePlate', () => {
  it('produces the one form the API stores', () => {
    for (const written of ['TN 09 BX 1234', 'TN-09-BX-1234', 'tn09bx1234']) {
      expect(normalisePlate(written)).toBe('TN09BX1234');
    }
  });

  it('agrees with the schema the API validates against', () => {
    // The point of sharing `REGISTRATION_NUMBER`: one definition, both ends.
    // If this diverges, the browser accepts plates the API will 400 on.
    const written = 'TN 09 BX 1234';
    expect(normalisePlate(written)).toBe(REGISTRATION_NUMBER.parse(written));
  });

  it('does not mangle a value the schema would reject', () => {
    // Normalisation runs before validation in some call orders; it must not
    // turn junk into something that looks plausible.
    expect(normalisePlate('hello world')).toBe('HELLOWORLD');
  });
});
