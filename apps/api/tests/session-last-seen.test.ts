import { randomUUID } from 'node:crypto';

import type { SessionScope } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countSignedInUsers } from '../src/modules/admin/signed-in-users.js';
import { LAST_SEEN_REFRESH_MS } from '../src/modules/auth/session.service.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';

/**
 * `sessions.lastSeenAt` against a real database: a returning visit moves it,
 * and the admin overview counts distinct people from it — not sessions, not
 * devices, not operators.
 */

let h: AuthHarness;

beforeAll(async () => {
  h = await createAuthHarness();
});

afterAll(async () => {
  await h.close();
});

describe('session last-seen', () => {
  it('moves when a person comes back after an hour', async () => {
    h.google.claims = {
      subject: `last-seen-${randomUUID()}`,
      email: `last-seen-${randomUUID()}@dealers-drive.test`,
      emailVerified: true,
      name: 'Synthetic Returning Dealer',
    };
    const agent = h.agent();
    await h.signIn(agent);
    const me = await agent.get('/v1/auth/me').expect(200);
    const userId = me.body.user.id as string;

    const stale = new Date(Date.now() - 2 * LAST_SEEN_REFRESH_MS);
    await h.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { lastSeenAt: stale },
    });

    await agent.get('/v1/auth/me').expect(200);

    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session.lastSeenAt.getTime()).toBeGreaterThan(stale.getTime());
  });
});

describe('countSignedInUsers', () => {
  const FUTURE = new Date('2099-06-01T00:00:00.000Z');
  const DAY = 24 * 60 * 60 * 1000;

  async function person(): Promise<string> {
    const user = await h.prisma.user.create({ data: { fullName: 'Synthetic Counted Person' } });
    return user.id;
  }

  async function seen(userId: string, scope: SessionScope, lastSeenAt: Date): Promise<void> {
    await h.prisma.session.create({
      data: {
        userId,
        scope,
        tokenHash: randomUUID(),
        expiresAt: new Date(lastSeenAt.getTime() + DAY),
        lastSeenAt,
      },
    });
  }

  it('counts distinct people across buyers and dealers, leaving out admins and merged accounts', async () => {
    const recent = new Date(FUTURE.getTime() - DAY);

    const both = await person();
    await seen(both, 'CUSTOMER', recent);
    await seen(both, 'DEALER', recent);
    await seen(both, 'DEALER', recent);

    const buyer = await person();
    await seen(buyer, 'CUSTOMER', recent);

    const dealer = await person();
    await seen(dealer, 'DEALER', recent);

    const operator = await person();
    await seen(operator, 'ADMIN', recent);

    const lapsed = await person();
    await seen(lapsed, 'CUSTOMER', new Date(FUTURE.getTime() - 31 * DAY));

    const absorbed = await person();
    await h.prisma.user.update({
      where: { id: absorbed },
      data: { mergedIntoId: both, mergedAt: recent },
    });
    await seen(absorbed, 'CUSTOMER', recent);

    expect(await countSignedInUsers(h.prisma, FUTURE)).toEqual({
      total: 3,
      buyers: 2,
      dealers: 2,
    });
  });
});
