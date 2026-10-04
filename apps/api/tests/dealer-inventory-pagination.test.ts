import { DealerInventoryResponse } from '@dealers-drive/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { encodeCursor } from '../src/platform/pagination.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * BUG-NEW-007. The dealer inventory paged on `createdAt` alone, with a strict
 * `<` boundary, so rows sharing the last row's timestamp were skipped — five
 * tied rows in pages of two returned two. It now pages on `(createdAt, id)`,
 * the order it already sorted by, as the other lists have since BUG-003.
 */
let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let sequence = 0;
const tied = new Date('2026-10-01T09:00:00.123Z');

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'inventory-page');
});

afterAll(async () => {
  await h.close();
});

async function stock(dealer: Dealership, count: number, plates: string) {
  sequence += 1;
  for (let n = 0; n < count; n += 1) {
    await dealer.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: `${plates}${String(sequence)}${String(100 + n)}` })
      .expect(201);
  }
  await h.prisma.vehicle.updateMany({
    where: { dealerId: dealer.dealerId },
    data: { createdAt: tied },
  });
  const rows = await h.prisma.vehicle.findMany({
    where: { dealerId: dealer.dealerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map((row) => row.id);
}

async function walk(dealer: Dealership, query: Record<string, string | number>) {
  const visited: string[] = [];
  const pages: number[] = [];
  let cursor: string | null = null;
  for (let n = 0; n < 10; n += 1) {
    const response = await dealer.agent
      .get('/v1/dealer/vehicles')
      .query({ ...query, ...(cursor ? { cursor } : {}) })
      .expect(200);
    const page = DealerInventoryResponse.parse(response.body);
    visited.push(...page.data.map((row) => row.id));
    pages.push(page.data.length);
    if (!page.page.hasMore) {
      expect(page.page.nextCursor).toBeNull();
      return { visited, pages };
    }
    expect(page.page.nextCursor).not.toBe(cursor);
    cursor = page.page.nextCursor;
  }
  throw new Error('Inventory pagination did not terminate');
}

describe('BUG-NEW-007 — the dealer inventory pages stably over equal timestamps', () => {
  it('visits every one of five tied vehicles exactly once in pages of two', async () => {
    const dealer = await fixtures.dealership();
    const expected = await stock(dealer, 5, 'KL07TI');

    const { visited, pages } = await walk(dealer, { limit: 2 });

    expect({ visited, pages }).toEqual({ visited: expected, pages: [2, 2, 1] });
  });

  it('keeps a search filter while paging tied rows', async () => {
    const dealer = await fixtures.dealership();
    const expected = await stock(dealer, 4, 'KL07TQ');

    const { visited } = await walk(dealer, { limit: 1, q: 'KL07TQ' });

    expect(visited).toEqual(expected);
  });

  it('keeps a status filter while paging tied rows', async () => {
    const dealer = await fixtures.dealership();
    const expected = await stock(dealer, 3, 'KL07TS');

    const { visited } = await walk(dealer, { limit: 1, status: 'DRAFT' });

    expect(visited).toEqual(expected);
  });

  it('still honours a date-only cursor issued before the fix', async () => {
    const dealer = await fixtures.dealership();
    await stock(dealer, 2, 'KL07TL');
    const later = new Date(tied.getTime() + 1);

    const response = await dealer.agent
      .get('/v1/dealer/vehicles')
      .query({ limit: 5, cursor: encodeCursor(later) })
      .expect(200);

    expect(DealerInventoryResponse.parse(response.body).data).toHaveLength(2);
  });

  it('refuses a malformed cursor', async () => {
    const dealer = await fixtures.dealership();

    const response = await dealer.agent
      .get('/v1/dealer/vehicles')
      .query({ cursor: Buffer.from('not-a-date|not-an-id').toString('base64url') });

    expect(response.body.code).toBe('MALFORMED_CURSOR');
  });
});
