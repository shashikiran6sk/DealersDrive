import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createReportsRepository } from '../../../../src/modules/reports/reports.repository.js';
import type { RcRecords } from '../../../../src/platform/rc/rc.port.js';

/**
 * Unit tests for `src/modules/reports/reports.repository.ts`.
 *
 * Two things are worth pinning here rather than leaving to the integration
 * suite. The aggregates — unpaid count and outstanding total — are computed on
 * write and rendered on every search card, so an error in them is an error
 * that is baked into rows we have already published and cannot be fixed by a
 * later read. And `latestForVehicles` reduces to newest-per-vehicle in memory
 * over a DESC ordering; a reduction that quietly picked the *oldest* row would
 * still return a plausible report for every card, which is precisely the kind
 * of wrong that no assertion on shape would catch.
 */
function records(overrides: Partial<RcRecords> = {}): RcRecords {
  return {
    rcStatus: 'ACTIVE',
    blacklistStatus: 'CLEAR',
    blacklistReasons: [],
    nocIssuedTo: null,
    challansAvailable: true,
    challans: [],
    financed: false,
    insuranceUpto: '2027-03-31',
    fitnessUpto: null,
    pucUpto: null,
    taxUpto: null,
    ...overrides,
  };
}

function challan(overrides: Partial<RcRecords['challans'][number]> = {}) {
  return {
    challanRef: '4417',
    offenceDate: '2025-04-02',
    offence: 'Speeding',
    amountPaise: 100_000,
    status: 'UNPAID' as const,
    court: false,
    ...overrides,
  };
}

function setup(rows: Record<string, unknown>[] = []) {
  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const queries: Record<string, unknown>[] = [];

  const prisma = {
    vehicleReport: {
      findFirst: (args: Record<string, unknown>) => {
        queries.push(args);
        return Promise.resolve(rows[0] ?? null);
      },
      findMany: (args: Record<string, unknown>) => {
        queries.push(args);
        return Promise.resolve(rows);
      },
      create: (args: { data: Record<string, unknown> }) => {
        creates.push(args.data);
        return Promise.resolve({ id: 'report-1', ...args.data });
      },
      updateMany: (args: Record<string, unknown>) => {
        updates.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaClient;

  return { repo: createReportsRepository(prisma), prisma, creates, updates, queries };
}

describe('latestForVehicle', () => {
  it('asks for the newest row rather than sorting after the fact', async () => {
    const h = setup([{ id: 'report-1', vehicleId: 'v1' }]);

    await expect(h.repo.latestForVehicle('v1')).resolves.toMatchObject({ id: 'report-1' });
    expect(h.queries[0]).toMatchObject({
      where: { vehicleId: 'v1' },
      orderBy: { fetchedAt: 'desc' },
    });
  });

  it('answers null for a vehicle that has never been checked', async () => {
    const h = setup();

    await expect(h.repo.latestForVehicle('v1')).resolves.toBeNull();
  });
});

describe('latestForVehicles', () => {
  it('makes no query at all for an empty page', async () => {
    // A results page with no cards must not cost a round trip.
    const h = setup([{ id: 'report-1', vehicleId: 'v1' }]);

    await expect(h.repo.latestForVehicles([])).resolves.toEqual(new Map());
    expect(h.queries).toHaveLength(0);
  });

  it('keeps the newest row per vehicle and discards the rest', async () => {
    // Rows arrive newest-first; the first one seen per vehicle wins.
    const h = setup([
      { id: 'new-1', vehicleId: 'v1' },
      { id: 'old-1', vehicleId: 'v1' },
      { id: 'new-2', vehicleId: 'v2' },
    ]);

    const map = await h.repo.latestForVehicles(['v1', 'v2']);

    expect(map.get('v1')).toMatchObject({ id: 'new-1' });
    expect(map.get('v2')).toMatchObject({ id: 'new-2' });
    expect(map.size).toBe(2);
  });

  it('reads one page of rows, not one query per card', async () => {
    const h = setup([]);

    await h.repo.latestForVehicles(['v1', 'v2', 'v3']);

    expect(h.queries).toHaveLength(1);
    expect(h.queries[0]).toMatchObject({ where: { vehicleId: { in: ['v1', 'v2', 'v3'] } } });
  });
});

describe('append', () => {
  it('counts and totals only the unpaid challans', async () => {
    const h = setup();

    await h.repo.append(h.prisma, {
      vehicleId: 'v1',
      dealerId: 'd1',
      provider: 'test',
      records: records({
        challans: [
          challan({ amountPaise: 100_000 }),
          challan({ challanRef: '9921', amountPaise: 50_000, status: 'PAID' }),
          challan({ challanRef: '3310', amountPaise: 25_000, status: 'UNPAID', court: true }),
        ],
      }),
    });

    expect(h.creates[0]).toMatchObject({
      challanCount: 3,
      challanUnpaidCount: 2,
      // Paise, and a BigInt — rule 3 applies to a fine as much as to a price.
      challanOutstandingPaise: 125_000n,
    });
  });

  it('records an empty challan list as a zero total, not as unavailable', async () => {
    const h = setup();

    await h.repo.append(h.prisma, {
      vehicleId: 'v1',
      dealerId: 'd1',
      provider: 'test',
      records: records({ challansAvailable: true, challans: [] }),
    });

    expect(h.creates[0]).toMatchObject({
      challansAvailable: true,
      challanCount: 0,
      challanOutstandingPaise: 0n,
    });
  });

  it('keeps a silent feed distinguishable from a clean one', async () => {
    // Both write zero counts. `challansAvailable` is the only thing separating
    // "we asked and there are none" from "we could not ask".
    const h = setup();

    await h.repo.append(h.prisma, {
      vehicleId: 'v1',
      dealerId: 'd1',
      provider: 'test',
      records: records({ challansAvailable: false, challans: [] }),
    });

    expect(h.creates[0]).toMatchObject({ challansAvailable: false, challanCount: 0 });
  });

  it('parses the validity dates it can and drops the ones it cannot', async () => {
    const h = setup();

    await h.repo.append(h.prisma, {
      vehicleId: 'v1',
      dealerId: 'd1',
      provider: 'test',
      records: records({ insuranceUpto: '2027-03-31', pucUpto: 'not a date', taxUpto: null }),
    });

    expect(h.creates[0]?.insuranceUpto).toBeInstanceOf(Date);
    // An unparseable date becomes absent, never Invalid Date — a NaN date
    // reaching Postgres is a 500 on a page that was rendering fine yesterday.
    expect(h.creates[0]?.pucUpto).toBeNull();
    expect(h.creates[0]?.taxUpto).toBeNull();
  });

  it('accepts a transaction handle so the draft and its report commit together', async () => {
    const h = setup();
    const creates: Record<string, unknown>[] = [];
    const tx = {
      vehicleReport: {
        create: (args: { data: Record<string, unknown> }) => {
          creates.push(args.data);
          return Promise.resolve({ id: 'report-tx', ...args.data });
        },
      },
    };

    await h.repo.append(tx as never, {
      vehicleId: 'v1',
      dealerId: 'd1',
      provider: 'test',
      records: records(),
    });

    // Written through the handle it was given, not through the base client.
    expect(creates).toHaveLength(1);
    expect(h.creates).toHaveLength(0);
  });

  it('offers no way to update or delete a row', async () => {
    // The absence is the design: a published claim has to stay readable
    // exactly as the buyer saw it.
    const h = setup();

    expect(Object.keys(h.repo).sort()).toEqual([
      'append',
      'latestForVehicle',
      'latestForVehicles',
      'markPublished',
    ]);
  });
});

describe('markPublished', () => {
  it('stamps a row once and leaves an already-stamped one alone', async () => {
    // `publishedAt: null` in the WHERE is what makes this idempotent: the
    // second call matches nothing rather than moving the date forward.
    const h = setup();

    await h.repo.markPublished('report-1');

    expect(h.updates[0]).toMatchObject({ where: { id: 'report-1', publishedAt: null } });
  });
});
