import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureSeat } from '../src/modules/auth/roles.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * `ensureSeat` under concurrency, against the real database.
 *
 * Two sign-ups for one number arrive together (a double tap, two devices):
 * both reach the account and both give it its seat. That second step must be
 * insert-or-nothing in one statement. As a Prisma `upsert` with an empty
 * `update` it was a read followed by an insert, and the loser of the race hit
 * the `(userId, role)` unique index and became a 500 — intermittently, which
 * is how it surfaced: `customer-auth.test.ts`'s race test failing in CI.
 */
let h: AuthHarness;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

describe('ensureSeat', () => {
  it('gives a seat exactly once however many callers race to give it', async () => {
    const users = await Promise.all(
      Array.from({ length: 30 }, (_, n) =>
        h.prisma.user.create({ data: { fullName: `Race ${String(n)}` } }),
      ),
    );

    for (const user of users) {
      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          ensureSeat(h.prisma, { userId: user.id, role: 'CUSTOMER' }),
        ),
      );
      expect(settled.filter((result) => result.status === 'rejected')).toEqual([]);
      expect(await h.prisma.userRole.count({ where: { userId: user.id, role: 'CUSTOMER' } })).toBe(
        1,
      );
    }
  });

  it('never reopens a seat that was closed', async () => {
    const user = await h.prisma.user.create({ data: { fullName: 'Closed' } });
    await h.prisma.userRole.create({
      data: { userId: user.id, role: 'CUSTOMER', status: 'SUSPENDED', reason: 'Abuse.' },
    });

    await ensureSeat(h.prisma, { userId: user.id, role: 'CUSTOMER' });

    expect(
      await h.prisma.userRole.findUniqueOrThrow({
        where: { userId_role: { userId: user.id, role: 'CUSTOMER' } },
      }),
    ).toMatchObject({ status: 'SUSPENDED', reason: 'Abuse.' });
  });
});
