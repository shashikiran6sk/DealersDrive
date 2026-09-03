import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { createDevSessionResolver } from '../../../../src/modules/auth/dev-session.adapter.js';

/**
 * CLAUDE.md §5: "The only thing being bypassed locally is the identity
 * verification mechanism." This adapter is where that promise is kept or
 * broken, so the tests below are mostly about what it *refuses* to read:
 *
 *  · the slug comes from `DEV_DEALER_SLUG`, never from the request;
 *  · the identity is re-read from the database on every call, so suspending a
 *    dealer in the admin console takes effect on the very next request —
 *    exactly as revoking a session will;
 *  · permissions are derived from the stored role, not carried in.
 *
 * The request is accepted as an argument only because the production
 * `CookieSessionResolver` will need somewhere to read a cookie from. Nothing
 * here touches it, and these tests prove it by passing one full of lies.
 */

const HOSTILE = {
  headers: { 'x-dealer-id': 'someone-elses-dealer', 'x-admin': 'true' },
  body: { dealerId: 'someone-elses-dealer', isPlatformAdmin: true },
  query: { dealerId: 'someone-elses-dealer' },
} as unknown as Request;

interface DealerRow {
  id: string;
  slug: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  members: { userId: string; role: 'OWNER' | 'MANAGER' | 'SALES' }[];
}

interface UserRow {
  id: string;
  email: string | null;
  adminRole: 'SUPPORT' | 'MODERATOR' | 'SUPER_ADMIN' | null;
}

function dealer(overrides: Partial<DealerRow> = {}): DealerRow {
  return {
    id: 'dealer-1',
    slug: 'sri-lakshmi-motors',
    status: 'ACTIVE',
    members: [{ userId: 'user-1', role: 'OWNER' }],
    ...overrides,
  };
}

function setup(rows: { dealer?: DealerRow | null; user?: UserRow | null } = {}) {
  const findUnique = vi.fn(() =>
    Promise.resolve(rows.dealer === undefined ? dealer() : rows.dealer),
  );
  const findFirst = vi.fn(() =>
    Promise.resolve(
      rows.user === undefined
        ? { id: 'admin-1', email: 'ops@dealers-drive.in', adminRole: 'SUPER_ADMIN' as const }
        : rows.user,
    ),
  );

  const prisma = {
    dealer: { findUnique },
    user: { findFirst },
  } as unknown as PrismaClient;

  return { resolver: createDevSessionResolver(prisma), findUnique, findFirst };
}

describe('resolveDealer', () => {
  it('returns a principal carrying a real dealer id, role and status', async () => {
    const { resolver } = setup();

    expect(await resolver.resolveDealer(HOSTILE)).toMatchObject({
      kind: 'DEALER',
      userId: 'user-1',
      dealerId: 'dealer-1',
      dealerSlug: 'sri-lakshmi-motors',
      role: 'OWNER',
      dealerStatus: 'ACTIVE',
    });
  });

  /** The identity is server-configured. Nothing on the request can move it. */
  it('looks the dealer up by the configured slug, ignoring the request', async () => {
    const { resolver, findUnique } = setup();

    await resolver.resolveDealer(HOSTILE);

    expect(findUnique).toHaveBeenCalledOnce();
    const where = (findUnique.mock.calls[0] as unknown as [{ where: { slug: string } }])[0].where;
    expect(where).toEqual({ slug: 'sri-lakshmi-motors' });
    expect(JSON.stringify(findUnique.mock.calls[0])).not.toContain('someone-elses-dealer');
  });

  it('only accepts an ACTIVE OWNER membership as the seat', async () => {
    const { resolver, findUnique } = setup();

    await resolver.resolveDealer(HOSTILE);

    const args = (
      findUnique.mock.calls[0] as unknown as [
        { include: { members: { where: unknown; take: number } } },
      ]
    )[0];
    expect(args.include.members.where).toEqual({ status: 'ACTIVE', role: 'OWNER' });
    expect(args.include.members.take).toBe(1);
  });

  it('derives permissions from the stored role', async () => {
    const { resolver } = setup();

    const principal = await resolver.resolveDealer(HOSTILE);

    expect(principal?.permissions).toContain('billing:purchase');
    expect(principal?.permissions).toContain('dealer:update');
  });

  it('gives a MANAGER seat the narrower permission set', async () => {
    const { resolver } = setup({
      dealer: dealer({ members: [{ userId: 'user-2', role: 'MANAGER' }] }),
    });

    const principal = await resolver.resolveDealer(HOSTILE);

    expect(principal?.role).toBe('MANAGER');
    expect(principal?.permissions).toContain('vehicle:write');
    expect(principal?.permissions).not.toContain('billing:purchase');
    expect(principal?.permissions).not.toContain('dealer:update');
  });

  it('returns null when the configured dealer is not seeded', async () => {
    const { resolver } = setup({ dealer: null });

    expect(await resolver.resolveDealer(HOSTILE)).toBeNull();
  });

  it('returns null when the dealer exists but has no active owner', async () => {
    const { resolver } = setup({ dealer: dealer({ members: [] }) });

    expect(await resolver.resolveDealer(HOSTILE)).toBeNull();
  });

  /**
   * The reason this re-reads rather than caching: a suspension applied in the
   * admin console must bite on the very next request, not at the next restart.
   */
  it('reports the dealer status as stored, so a suspension bites immediately', async () => {
    const { resolver } = setup({ dealer: dealer({ status: 'SUSPENDED' }) });

    expect((await resolver.resolveDealer(HOSTILE))?.dealerStatus).toBe('SUSPENDED');
  });

  it('re-reads the database on every call', async () => {
    const { resolver, findUnique } = setup();

    await resolver.resolveDealer(HOSTILE);
    await resolver.resolveDealer(HOSTILE);
    await resolver.resolveDealer(HOSTILE);

    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('returns a PENDING dealer — read-only access is still access', async () => {
    const { resolver } = setup({ dealer: dealer({ status: 'PENDING' }) });

    expect((await resolver.resolveDealer(HOSTILE))?.dealerStatus).toBe('PENDING');
  });
});

describe('resolveAdmin', () => {
  it('returns an admin principal for the configured email', async () => {
    const { resolver } = setup();

    expect(await resolver.resolveAdmin(HOSTILE)).toMatchObject({
      kind: 'ADMIN',
      userId: 'admin-1',
      email: 'ops@dealers-drive.in',
      adminRole: 'SUPER_ADMIN',
    });
  });

  /** Two conditions, not one: the configured email *and* the stored flag. */
  it('requires isPlatformAdmin in the query, not just a matching email', async () => {
    const { resolver, findFirst } = setup();

    await resolver.resolveAdmin(HOSTILE);

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { email: 'ops@dealers-drive.in', isPlatformAdmin: true },
    });
  });

  it('ignores an x-admin header entirely', async () => {
    const { resolver, findFirst } = setup();

    await resolver.resolveAdmin(HOSTILE);

    expect(JSON.stringify(findFirst.mock.calls[0])).not.toContain('x-admin');
  });

  it('derives permissions from the stored admin role', async () => {
    const { resolver } = setup();

    expect((await resolver.resolveAdmin(HOSTILE))?.permissions).toContain('admin:credit:grant');
  });

  it('gives SUPPORT read permissions but no moderation ones', async () => {
    const { resolver } = setup({
      user: { id: 'admin-2', email: 'support@dealers-drive.in', adminRole: 'SUPPORT' },
    });

    const principal = await resolver.resolveAdmin(HOSTILE);

    expect(principal?.permissions).toContain('admin:payment:read');
    expect(principal?.permissions).not.toContain('admin:listing:moderate');
    expect(principal?.permissions).not.toContain('admin:credit:grant');
  });

  it('returns null when no platform admin is seeded', async () => {
    const { resolver } = setup({ user: null });

    expect(await resolver.resolveAdmin(HOSTILE)).toBeNull();
  });

  /**
   * A user can be flagged `isPlatformAdmin` without an `adminRole`. That is
   * not a session — a principal with no role would carry no permissions, and
   * "authenticated with zero capability" is a confusing 403 rather than a
   * clear 401.
   */
  it('returns null when the user has no adminRole', async () => {
    const { resolver } = setup({
      user: { id: 'admin-3', email: 'ops@dealers-drive.in', adminRole: null },
    });

    expect(await resolver.resolveAdmin(HOSTILE)).toBeNull();
  });

  it('falls back to the configured email when the row stores none', async () => {
    const { resolver } = setup({
      user: { id: 'admin-4', email: null, adminRole: 'MODERATOR' },
    });

    expect((await resolver.resolveAdmin(HOSTILE))?.email).toBe('ops@dealers-drive.in');
  });

  it('re-reads on every call, so revoking admin takes effect at once', async () => {
    const { resolver, findFirst } = setup();

    await resolver.resolveAdmin(HOSTILE);
    await resolver.resolveAdmin(HOSTILE);

    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
