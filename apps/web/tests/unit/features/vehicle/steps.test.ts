import { describe, expect, it } from 'vitest';

import { toStep, WIZARD_STEPS } from '../../../../src/features/vehicle/steps.js';

/**
 * DESIGN-SPEC §3.14 — the four wizard steps, shared by the stepper and the
 * router so neither can disagree about which step is which.
 *
 * `toStep` exists because the step lives in the URL, and a URL is
 * user-editable. Every unparseable value has to land somewhere sensible rather
 * than rendering step `NaN`, which would blank the wizard mid-listing.
 */

describe('WIZARD_STEPS', () => {
  it('names the four steps in order', () => {
    expect(WIZARD_STEPS).toEqual(['Basics', 'Details', 'Photos', 'Price & review']);
  });

  it('names each step once', () => {
    expect(new Set(WIZARD_STEPS).size).toBe(WIZARD_STEPS.length);
  });

  /** Price is last because it is the field a dealer changes after seeing the rest. */
  it('puts price and review at the end', () => {
    expect(WIZARD_STEPS.at(-1)).toBe('Price & review');
  });
});

describe('toStep', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    ['3', 3],
  ])('reads ?step=%s as step %i', (raw, expected) => {
    expect(toStep(raw)).toBe(expected);
  });

  /**
   * Details rather than Basics: a dealer arriving with a broken link has
   * usually already created the vehicle, and dropping them back to step 0
   * would suggest their work was lost.
   */
  it('lands on Details when there is no step at all', () => {
    expect(toStep(undefined)).toBe(1);
  });

  it.each(['two', '-1', '4', '99', '1.5', 'NaN', 'Infinity'])(
    'lands on Details for the unparseable "%s"',
    (raw) => {
      expect(toStep(raw)).toBe(1);
    },
  );

  /**
   * `?step=` with no value is the one input that does not follow the rule in
   * the docblock: `Number('')` is `0`, so an empty step reads as Basics rather
   * than Details. Harmless — the wizard renders a real step either way — but
   * pinned here because it is a genuine gap between the comment and the code,
   * and the next reader should not have to rediscover it.
   */
  it('reads an empty ?step= as Basics, not Details', () => {
    expect(toStep('')).toBe(0);
  });

  it('never returns a step the wizard cannot render', () => {
    for (const raw of ['0', '3', '9', 'x', undefined, '']) {
      expect(WIZARD_STEPS[toStep(raw)]).toBeDefined();
    }
  });
});
