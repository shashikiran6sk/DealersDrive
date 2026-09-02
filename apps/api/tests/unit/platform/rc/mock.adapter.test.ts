import { describe, expect, it } from 'vitest';

import { createMockRcLookup } from '../../../../src/platform/rc/mock.adapter.js';
import { RcLookupError } from '../../../../src/platform/rc/rc.port.js';
import { resolveMake } from '../../../../src/platform/rc/rc-match.js';
import { MAKER_ALIASES } from '../../../../src/platform/rc/rc-aliases.js';

/**
 * The provider every developer, test and demo actually runs against.
 *
 * Two properties matter. It must be **deterministic**, or a failing test is
 * unreproducible and a screenshot in a bug report means nothing. And its
 * reserved plates must genuinely reach the interesting branches, because a
 * mock that only produces happy paths guarantees the failure paths ship
 * untested — which for this feature means shipping "records unavailable"
 * rendering as "no challans".
 */
const rc = createMockRcLookup();

describe('determinism', () => {
  it('gives the same car for the same plate, every time', async () => {
    const first = await rc.lookup('TN09BX1234');
    const second = await rc.lookup('TN09BX1234');
    expect(first).toEqual(second);
  });

  it('gives different cars for different plates', async () => {
    const results = await Promise.all(
      ['TN09BX1234', 'TN10CD5678', 'KA51MH2020', 'TN23AB4417'].map((reg) => rc.lookup(reg)),
    );
    const models = new Set(results.map((row) => row.specs.makerModel));
    expect(models.size).toBeGreaterThan(1);
  });
});

describe('the reserved plates', () => {
  it('produces a not-found, so the manual fallback is reachable', async () => {
    await expect(rc.lookup('TN01AA0000')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('produces an outage, so the 503 path is reachable', async () => {
    const failure = rc.lookup('TN01AA9999');
    await expect(failure).rejects.toBeInstanceOf(RcLookupError);
    await expect(failure).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });

  it('produces a blacklisted vehicle, so the submission blocker is reachable', async () => {
    const { records } = await rc.lookup('TN01BL0001');
    expect(records.blacklistStatus).toBe('BLACKLISTED');
    expect(records.blacklistReasons.length).toBeGreaterThan(0);
  });

  it('produces an NOC, so the amber advisory is reachable', async () => {
    const { records } = await rc.lookup('TN01NC0001');
    expect(records.blacklistStatus).toBe('NOC_ISSUED');
    expect(records.nocIssuedTo).toBe('Karnataka');
  });

  it('produces unpaid challans', async () => {
    const { records } = await rc.lookup('TN01CH0001');
    expect(records.challansAvailable).toBe(true);
    expect(records.challans.filter((row) => row.status === 'UNPAID')).toHaveLength(2);
  });

  /**
   * The case a hand-written happy-path mock never covers, and the one that
   * matters most: the feed said nothing, which is not the same as saying none.
   */
  it('produces a silent challan feed, distinct from an empty one', async () => {
    const silent = await rc.lookup('TN01NF0001');
    expect(silent.records.challansAvailable).toBe(false);
    expect(silent.records.challans).toEqual([]);

    const ordinary = await rc.lookup('TN09BX1234');
    expect(ordinary.records.challansAvailable).toBe(true);
  });

  it('produces a make the catalogue does not carry', async () => {
    const { specs } = await rc.lookup('TN01ZZ0001');
    expect(specs.makerDescription).toBe('FORCE MOTORS LIMITED');
  });
});

describe('what it feeds the resolver', () => {
  /**
   * A mock whose maker strings do not resolve would make every local intake
   * look broken, and would hide a genuine alias-table gap behind "it's only
   * the mock".
   */
  it('emits maker strings the alias table actually knows', async () => {
    const makes = Object.values(MAKER_ALIASES).map((slug, index) => ({
      id: `mk-${index}`,
      slug,
      name: slug,
      models: [],
    }));

    const plates = ['TN09BX1234', 'TN10CD5678', 'KA51MH2020', 'TN23AB4417', 'TN02XY7788'];
    for (const plate of plates) {
      const { specs } = await rc.lookup(plate);
      expect(
        resolveMake(specs, makes).value,
        `${plate} → ${specs.makerDescription}`,
      ).not.toBeNull();
    }
  });

  it('emits years inside the range a used-car yard actually holds', async () => {
    const { specs } = await rc.lookup('TN09BX1234');
    const year = new Date(String(specs.manufacturedOn)).getUTCFullYear();
    expect(year).toBeGreaterThanOrEqual(2011);
    expect(year).toBeLessThanOrEqual(2026);
  });
});
