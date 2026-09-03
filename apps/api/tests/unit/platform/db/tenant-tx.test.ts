import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { Tx } from '../../../../src/platform/db/prisma.js';
import { withTenant, withTransaction } from '../../../../src/platform/db/tenant-tx.js';

/**
 * Unit tests for `src/platform/db/tenant-tx.ts`.
 *
 * `SET LOCAL app.dealer_id` is the one line in the codebase that concatenates
 * SQL, because `SET LOCAL` cannot be parameterised. So the guard on that
 * interpolation is the thing worth testing in isolation, and the fake Prisma
 * here exists to capture the exact statement issued.
 */
const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';

interface FakeTx {
  $executeRawUnsafe: (sql: string) => Promise<number>;
}

/** Records every raw statement, and whether the work ran inside the callback. */
function fakePrisma(): {
  prisma: PrismaClient;
  statements: string[];
  transactions: number;
} {
  const statements: string[] = [];
  let transactions = 0;

  const prisma = {
    async $transaction<T>(work: (tx: FakeTx) => Promise<T>): Promise<T> {
      transactions += 1;
      return work({
        $executeRawUnsafe: (sql: string) => {
          statements.push(sql);
          return Promise.resolve(1);
        },
      });
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    statements,
    get transactions() {
      return transactions;
    },
  };
}

describe('withTenant', () => {
  it('stamps the tenant on the transaction before the work runs', async () => {
    const fake = fakePrisma();
    const order: string[] = [];

    await withTenant(fake.prisma, DEALER, async () => {
      order.push('work');
      return 'ok';
    });

    // The SET LOCAL must land first: work that reads a table under RLS before
    // the stamp exists would see nothing.
    expect(fake.statements).toEqual([`SET LOCAL app.dealer_id = '${DEALER}'`]);
    expect(order).toEqual(['work']);
  });

  it('returns the work’s value', async () => {
    const fake = fakePrisma();

    await expect(withTenant(fake.prisma, DEALER, async () => 42)).resolves.toBe(42);
  });

  it('issues the SET LOCAL unconditionally, so enabling RLS is a database change', async () => {
    const fake = fakePrisma();

    await withTenant(fake.prisma, DEALER, async () => null);

    expect(fake.statements).toHaveLength(1);
  });

  it('runs everything inside exactly one transaction', async () => {
    const fake = fakePrisma();

    await withTenant(fake.prisma, DEALER, async () => null);

    expect(fake.transactions).toBe(1);
  });

  it('passes the transaction handle through to the work', async () => {
    const fake = fakePrisma();
    let received: Tx | undefined;

    await withTenant(fake.prisma, DEALER, async (tx) => {
      received = tx;
      return null;
    });

    expect(received).toBeDefined();
  });

  it('propagates a failure in the work rather than swallowing it', async () => {
    const fake = fakePrisma();

    await expect(
      withTenant(fake.prisma, DEALER, () => Promise.reject(new Error('write failed'))),
    ).rejects.toThrow('write failed');
  });

  describe('the uuid guard on the interpolated id', () => {
    it('refuses anything that is not a uuid, before touching the database', async () => {
      const fake = fakePrisma();
      const work = vi.fn();

      await expect(withTenant(fake.prisma, "'; DROP TABLE dealers; --", work)).rejects.toThrow(
        /Refusing to set a non-uuid tenant id/,
      );

      expect(work).not.toHaveBeenCalled();
      expect(fake.statements).toEqual([]);
    });

    it('refuses the near-misses too', async () => {
      const fake = fakePrisma();
      const cases = [
        '',
        'not-a-uuid',
        `${DEALER} `,
        ` ${DEALER}`,
        `${DEALER}'`,
        DEALER.replace('-', ''),
        `${DEALER}${DEALER}`,
      ];

      for (const value of cases) {
        await expect(
          withTenant(fake.prisma, value, async () => null),
          `"${value}" should be refused`,
        ).rejects.toThrow(/non-uuid/);
      }
    });

    it('accepts an uppercase uuid, which Postgres treats as the same value', async () => {
      const fake = fakePrisma();

      await withTenant(fake.prisma, DEALER.toUpperCase(), async () => null);

      expect(fake.statements[0]).toContain(DEALER.toUpperCase());
    });
  });
});

describe('withTransaction', () => {
  it('opens a transaction without stamping a tenant', async () => {
    const fake = fakePrisma();

    const result = await withTransaction(fake.prisma, async () => 'platform work');

    // Deliberately unstamped: outbox publishing and job handlers legitimately
    // span tenants, and a stamp there would be a lie.
    expect(result).toBe('platform work');
    expect(fake.statements).toEqual([]);
    expect(fake.transactions).toBe(1);
  });

  it('propagates failures', async () => {
    const fake = fakePrisma();

    await expect(
      withTransaction(fake.prisma, () => Promise.reject(new Error('rollback'))),
    ).rejects.toThrow('rollback');
  });
});
