import type { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createEnquiriesRepository,
  enquiryInclude,
} from '../../../../src/modules/enquiries/enquiries.repository.js';

/**
 * A lead is the product's revenue event, so two things here are load-bearing.
 *
 * **The reference is drawn from a platform-wide sequence**, not derived from
 * the uuid and not per-dealer. A per-dealer counter would leak that
 * dealership's lead volume to anyone holding two references; platform-wide
 * volume is not sensitive (§14.2).
 *
 * **Every dealer-scoped read puts `dealerId` in the WHERE clause** — including
 * the duplicate check, which is otherwise the one place a phone number could
 * be probed across tenants.
 */

const DEALER = 'dealer-1';
const OTHER_DEALER = 'dealer-2';

function fakePrisma(results: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, fallback: unknown) => {
    const result = name in results ? results[name] : fallback;
    return vi.fn((args: unknown) => {
      (calls[name] ??= []).push(args);
      return Promise.resolve(result);
    });
  };

  const prisma = {
    enquiry: {
      findFirst: record('enquiry.findFirst', null),
      findMany: record('enquiry.findMany', []),
      findUnique: record('enquiry.findUnique', { id: 'e1' }),
      updateMany: record('enquiry.updateMany', { count: 1 }),
      groupBy: record('enquiry.groupBy', []),
    },
    phoneReveal: { count: record('phoneReveal.count', 0) },
  } as unknown as PrismaClient;

  return { prisma, repo: createEnquiriesRepository(prisma), calls };
}

function fakeTx(reference = 'DD-EN-10001') {
  const calls: Record<string, unknown[]> = {};
  const tx = {
    $queryRaw: vi.fn(() => Promise.resolve(reference === '' ? [] : [{ reference }])),
    enquiry: {
      create: vi.fn((args: unknown) => {
        (calls['enquiry.create'] ??= []).push(args);
        return Promise.resolve({ id: 'e1' });
      }),
      findFirst: vi.fn((args: unknown) => {
        (calls['enquiry.findFirst'] ??= []).push(args);
        return Promise.resolve(null);
      }),
    },
    phoneReveal: {
      create: vi.fn((args: unknown) => {
        (calls['phoneReveal.create'] ??= []).push(args);
        return Promise.resolve({ id: 'r1' });
      }),
    },
  };
  return { tx, calls };
}

function whereOf(calls: Record<string, unknown[]>, key: string): Record<string, unknown> {
  return (calls[key]?.[0] as { where: Record<string, unknown> }).where;
}

describe('nextReference', () => {
  it('returns a DD-EN-prefixed reference from the sequence', async () => {
    const { repo } = fakePrisma();
    const { tx } = fakeTx('DD-EN-10042');

    expect(await repo.nextReference(tx as never)).toBe('DD-EN-10042');
  });

  /** Sequential *platform-wide*, so it reveals nothing about one dealer's volume. */
  it('draws from the shared enquiry_reference_seq', async () => {
    const { repo } = fakePrisma();
    const { tx } = fakeTx();

    await repo.nextReference(tx as never);

    const [template] = tx.$queryRaw.mock.calls[0] as unknown as [string[]];
    expect(template.join('')).toContain('enquiry_reference_seq');
  });

  it('runs inside the caller transaction, so a rolled-back enquiry burns no number visibly', async () => {
    const { repo, prisma } = fakePrisma();
    const { tx } = fakeTx();

    await repo.nextReference(tx as never);

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma).not.toHaveProperty('$queryRaw.mock');
  });

  /** Better to fail the enquiry than to write one with no reference to quote. */
  it('throws rather than returning an empty reference', async () => {
    const { repo } = fakePrisma();
    const { tx } = fakeTx('');

    await expect(repo.nextReference(tx as never)).rejects.toThrow(
      'enquiry_reference_seq returned nothing',
    );
  });
});

describe('findRecentDuplicate', () => {
  it('matches on phone, vehicle and dealer together', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findRecentDuplicate('+919876543210', 'vehicle-1', DEALER);

    expect(whereOf(calls, 'enquiry.findFirst')).toMatchObject({
      phone: '+919876543210',
      vehicleId: 'vehicle-1',
      dealerId: DEALER,
    });
  });

  /**
   * Without the dealer clause this method would answer "has this number
   * enquired anywhere in the last day", which is a cross-tenant probe.
   */
  it('never matches another dealer’s enquiry', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findRecentDuplicate('+919876543210', 'vehicle-1', OTHER_DEALER);

    expect(whereOf(calls, 'enquiry.findFirst').dealerId).toBe(OTHER_DEALER);
  });

  it('looks back exactly 24 hours', async () => {
    const { repo, calls } = fakePrisma();
    const before = Date.now();

    await repo.findRecentDuplicate('+919876543210', 'vehicle-1', DEALER);

    const since = (whereOf(calls, 'enquiry.findFirst').createdAt as { gte: Date }).gte;
    const window = before - since.getTime();
    expect(window).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    expect(window).toBeLessThan(24 * 60 * 60 * 1000 + 5_000);
  });

  /** A general enquiry (no vehicle) dedupes against other general enquiries only. */
  it('matches a null vehicle as null, not as "any vehicle"', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findRecentDuplicate('+919876543210', null, DEALER);

    expect(whereOf(calls, 'enquiry.findFirst').vehicleId).toBeNull();
  });

  it('returns the most recent match', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findRecentDuplicate('+919876543210', 'vehicle-1', DEALER);

    expect((calls['enquiry.findFirst']?.[0] as { orderBy: unknown }).orderBy).toEqual({
      createdAt: 'desc',
    });
  });

  it('returns null when there is no recent lead', async () => {
    const { repo } = fakePrisma({ 'enquiry.findFirst': null });

    expect(await repo.findRecentDuplicate('+919876543210', 'vehicle-1', DEALER)).toBeNull();
  });

  /** The dedupe check and the insert must see the same snapshot. */
  it('runs on the transaction client when one is given', async () => {
    const { repo, calls } = fakePrisma();
    const { tx, calls: txCalls } = fakeTx();

    await repo.findRecentDuplicate('+919876543210', 'vehicle-1', DEALER, tx as never);

    expect(txCalls['enquiry.findFirst']).toHaveLength(1);
    expect(calls['enquiry.findFirst']).toBeUndefined();
  });
});

describe('create', () => {
  it('writes through the transaction and returns the row with its vehicle', async () => {
    const { repo } = fakePrisma();
    const { tx, calls } = fakeTx();

    await repo.create(
      tx as never,
      {
        dealerId: DEALER,
        phone: '+919876543210',
      } as unknown as Prisma.EnquiryUncheckedCreateInput,
    );

    expect((calls['enquiry.create']?.[0] as { include: unknown }).include).toBe(enquiryInclude);
  });
});

describe('listForDealer', () => {
  it('scopes to the dealer', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect(whereOf(calls, 'enquiry.findMany')).toEqual({ dealerId: DEALER });
  });

  it('filters by status when asked', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, status: 'NEW' });

    expect(whereOf(calls, 'enquiry.findMany').status).toBe('NEW');
  });

  it('returns every status when none is given', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect(whereOf(calls, 'enquiry.findMany')).not.toHaveProperty('status');
  });

  it('pages strictly past the cursor', async () => {
    const cursor = new Date('2026-03-01T10:00:00Z');
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20, cursor });

    expect(whereOf(calls, 'enquiry.findMany').createdAt).toEqual({ lt: cursor });
  });

  it('over-fetches by one to detect a next page', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect((calls['enquiry.findMany']?.[0] as { take: number }).take).toBe(21);
  });

  it('orders newest first — a lead loses value by the hour', async () => {
    const { repo, calls } = fakePrisma();

    await repo.listForDealer(DEALER, { limit: 20 });

    expect((calls['enquiry.findMany']?.[0] as { orderBy: unknown }).orderBy).toEqual({
      createdAt: 'desc',
    });
  });
});

describe('findForDealer', () => {
  it('scopes to the dealer as well as the id', async () => {
    const { repo, calls } = fakePrisma();

    await repo.findForDealer(DEALER, 'enquiry-1');

    expect(whereOf(calls, 'enquiry.findFirst')).toEqual({ id: 'enquiry-1', dealerId: DEALER });
  });

  it('returns null for another dealer’s enquiry — the 404 comes from here', async () => {
    const { repo } = fakePrisma({ 'enquiry.findFirst': null });

    expect(await repo.findForDealer(OTHER_DEALER, 'enquiry-1')).toBeNull();
  });
});

describe('countsForDealer', () => {
  /** One grouped query rather than four list calls (§14.3). */
  it('groups by status in a single query', async () => {
    const { repo, calls } = fakePrisma();

    await repo.countsForDealer(DEALER);

    expect(calls['enquiry.groupBy']).toHaveLength(1);
    expect(calls['enquiry.groupBy']?.[0]).toMatchObject({
      by: ['status'],
      where: { dealerId: DEALER },
    });
  });

  it('maps the rows onto the counts', async () => {
    const { repo } = fakePrisma({
      'enquiry.groupBy': [
        { status: 'NEW', _count: { _all: 4 } },
        { status: 'CLOSED', _count: { _all: 2 } },
      ],
    });

    expect(await repo.countsForDealer(DEALER)).toEqual({
      NEW: 4,
      CONTACTED: 0,
      CLOSED: 2,
      SPAM: 0,
    });
  });

  /** The tab badges render from this, so a missing status must be 0, not absent. */
  it('reports every status as zero for a dealer with no leads', async () => {
    const { repo } = fakePrisma({ 'enquiry.groupBy': [] });

    expect(await repo.countsForDealer(DEALER)).toEqual({
      NEW: 0,
      CONTACTED: 0,
      CLOSED: 0,
      SPAM: 0,
    });
  });
});

describe('updateForDealer', () => {
  /** The dealer clause is inside the writing statement, closing the TOCTOU gap. */
  it('re-checks ownership in the update itself', async () => {
    const { repo, calls } = fakePrisma();

    await repo.updateForDealer(DEALER, 'enquiry-1', { status: 'CONTACTED' });

    expect(whereOf(calls, 'enquiry.updateMany')).toEqual({ id: 'enquiry-1', dealerId: DEALER });
  });

  it('returns null without reading back when nothing matched', async () => {
    const { repo, calls } = fakePrisma({ 'enquiry.updateMany': { count: 0 } });

    expect(await repo.updateForDealer(OTHER_DEALER, 'enquiry-1', { status: 'CLOSED' })).toBeNull();
    expect(calls['enquiry.findUnique']).toBeUndefined();
  });

  it('reads the updated row back with its vehicle', async () => {
    const { repo, calls } = fakePrisma();

    await repo.updateForDealer(DEALER, 'enquiry-1', { status: 'CLOSED' });

    expect((calls['enquiry.findUnique']?.[0] as { include: unknown }).include).toBe(enquiryInclude);
  });
});

describe('recentForDealer', () => {
  /** The dashboard strip. Spam is filtered out — it is noise, not a lead. */
  it('excludes spam', async () => {
    const { repo, calls } = fakePrisma();

    await repo.recentForDealer(DEALER, 5);

    expect(whereOf(calls, 'enquiry.findMany')).toEqual({
      dealerId: DEALER,
      status: { not: 'SPAM' },
    });
  });

  it('takes exactly the limit — this list is not paged', async () => {
    const { repo, calls } = fakePrisma();

    await repo.recentForDealer(DEALER, 5);

    expect((calls['enquiry.findMany']?.[0] as { take: number }).take).toBe(5);
  });
});

describe('recordReveal', () => {
  it('records the reveal inside the caller transaction', async () => {
    const { repo } = fakePrisma();
    const { tx, calls } = fakeTx();

    await repo.recordReveal(tx as never, {
      dealerId: DEALER,
      vehicleId: 'vehicle-1',
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0',
    });

    expect((calls['phoneReveal.create']?.[0] as { data: unknown }).data).toEqual({
      dealerId: DEALER,
      vehicleId: 'vehicle-1',
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('stores null rather than undefined for a missing user agent', async () => {
    const { repo } = fakePrisma();
    const { tx, calls } = fakeTx();

    await repo.recordReveal(tx as never, {
      dealerId: DEALER,
      vehicleId: null,
      ip: '203.0.113.1',
    });

    expect(
      (calls['phoneReveal.create']?.[0] as { data: { userAgent: unknown } }).data.userAgent,
    ).toBeNull();
  });

  it('accepts a reveal with no vehicle — a portfolio reveal has none', async () => {
    const { repo } = fakePrisma();
    const { tx, calls } = fakeTx();

    await repo.recordReveal(tx as never, { dealerId: DEALER, vehicleId: null, ip: '1.1.1.1' });

    expect(
      (calls['phoneReveal.create']?.[0] as { data: { vehicleId: unknown } }).data.vehicleId,
    ).toBeNull();
  });
});

describe('revealsToday', () => {
  /** The spend control: reveals are counted per IP across every dealer. */
  it('counts one IP’s reveals in the last 24 hours', async () => {
    const { repo, calls } = fakePrisma({ 'phoneReveal.count': 3 });
    const before = Date.now();

    expect(await repo.revealsToday('203.0.113.1')).toBe(3);

    const where = whereOf(calls, 'phoneReveal.count');
    expect(where.ip).toBe('203.0.113.1');
    const window = before - (where.createdAt as { gte: Date }).gte.getTime();
    expect(window).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('is zero for an IP that has revealed nothing', async () => {
    const { repo } = fakePrisma({ 'phoneReveal.count': 0 });

    expect(await repo.revealsToday('198.51.100.9')).toBe(0);
  });
});
