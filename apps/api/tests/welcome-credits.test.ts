import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { grantWelcomeCredits, moveCredits } from '../src/modules/billing/billing.facade.js';
import type { PlatformConfigService } from '../src/platform/config/platform-config.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;

const SYSTEM = { type: 'SYSTEM' as const, id: null };

function welcomeSetting(credits: number): PlatformConfigService {
  return { number: () => Promise.resolve(credits) } as unknown as PlatformConfigService;
}

const BACKFILL = new URL(
  '../prisma/migrations/20261119090200_welcome_credits_backfill/migration.sql',
  import.meta.url,
);

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'welcome');
});

afterAll(async () => {
  await h.close();
});

describe('welcome credits', () => {
  it('grants them once, however often a dealership is activated', async () => {
    const d = await fixtures.dealership();
    const grant = () =>
      h.prisma.$transaction((tx) => grantWelcomeCredits(tx, welcomeSetting(5), d.dealerId, SYSTEM));
    expect([await grant(), await grant()]).toEqual([5, 0]);

    const rows = await h.prisma.creditTransaction.findMany({ where: { dealerId: d.dealerId } });
    expect(rows).toEqual([
      expect.objectContaining({ reason: 'WELCOME_GRANT', delta: 5, balanceAfter: 5, heldAfter: 0 }),
    ]);
    const dealer = await h.prisma.dealer.findUniqueOrThrow({ where: { id: d.dealerId } });
    expect(dealer).toMatchObject({ creditBalance: 5, creditsHeld: 0 });
  });

  it('grants nothing while the setting is 0', async () => {
    const d = await fixtures.dealership();
    const granted = await h.prisma.$transaction((tx) =>
      grantWelcomeCredits(tx, welcomeSetting(0), d.dealerId, SYSTEM),
    );
    expect(granted).toBe(0);
    expect(await h.prisma.creditTransaction.count({ where: { dealerId: d.dealerId } })).toBe(0);
  });

  it('refuses a second welcome grant in the database itself', async () => {
    const d = await fixtures.dealership();
    await h.prisma.$transaction((tx) =>
      grantWelcomeCredits(tx, welcomeSetting(5), d.dealerId, SYSTEM),
    );
    await expect(
      h.prisma.$transaction((tx) =>
        moveCredits(tx, { dealerId: d.dealerId, reason: 'WELCOME_GRANT', delta: 5, actor: SYSTEM }),
      ),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('backfills every dealership approved before them, once, on top of what each already has', async () => {
    const approved = await fixtures.dealership();
    const waiting = await fixtures.dealership('PENDING_APPROVAL');
    await h.prisma.$transaction((tx) =>
      moveCredits(tx, {
        dealerId: approved.dealerId,
        reason: 'ADMIN_GRANT',
        delta: 3,
        actor: SYSTEM,
      }),
    );
    const sql = await readFile(BACKFILL, 'utf8');

    let seen: { reasons: string[]; balance: number; dealer: number; waiting: number } | null = null;
    await expect(
      h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(sql);
        await tx.$executeRawUnsafe(sql);
        const rows = await tx.creditTransaction.findMany({
          where: { dealerId: approved.dealerId },
          orderBy: { id: 'asc' },
        });
        const dealer = await tx.dealer.findUniqueOrThrow({ where: { id: approved.dealerId } });
        seen = {
          reasons: rows.map((row) => row.reason),
          balance: rows.at(-1)?.balanceAfter ?? 0,
          dealer: dealer.creditBalance,
          waiting: await tx.creditTransaction.count({ where: { dealerId: waiting.dealerId } }),
        };
        throw new Error('roll back the backfill');
      }),
    ).rejects.toThrow('roll back the backfill');

    expect(seen).toEqual({
      reasons: ['ADMIN_GRANT', 'WELCOME_GRANT'],
      balance: 8,
      dealer: 8,
      waiting: 0,
    });
  });
});
