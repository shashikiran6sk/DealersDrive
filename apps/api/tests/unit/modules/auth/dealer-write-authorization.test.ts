import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { authorizeDealerWrite } from '../../../../src/modules/auth/dealer-write-authorization.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';

const actor = {
  dealerId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
};
const session = {
  userId: actor.userId,
  scope: 'DEALER',
  revokedAt: null,
  expiresAt: new Date('2099-01-01T00:00:00Z'),
};

function database(overrides: Record<string, unknown[]> = {}) {
  const records: Record<string, unknown[]> = {
    dealers: [{ status: 'ACTIVE' }],
    dealer_members: [{ status: 'ACTIVE', role: 'MANAGER' }],
    users: [{ status: 'ACTIVE' }],
    user_roles: [{ status: 'ACTIVE' }],
    sessions: [session],
    ...overrides,
  };
  const query = vi.fn(async (sql: Prisma.Sql) => {
    const table = /FROM "(\w+)"/.exec(sql.sql)?.[1] ?? '';
    return records[table] ?? [];
  });
  return { tx: { $queryRaw: query } as unknown as Tx, query };
}

describe('current dealer write authority', () => {
  it('returns the current role permissions and holds all real-cookie authority rows', async () => {
    const { tx, query } = database();
    const permissions = await authorizeDealerWrite(tx, actor, 'listing:submit', true);
    expect(permissions).toContain('listing:submit');
    expect(permissions).not.toContain('member:manage');
    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls.every(([sql]) => sql.sql.includes('FOR SHARE SKIP LOCKED'))).toBe(true);
  });

  it.each(['dealers', 'dealer_members', 'users', 'sessions'])(
    'denies a missing %s authority row',
    async (table) => {
      const { tx } = database({ [table]: [] });
      await expect(authorizeDealerWrite(tx, actor, 'listing:submit')).rejects.toMatchObject({
        status: 401,
      });
    },
  );

  it.each([
    ['dealers', { status: 'SUSPENDED' }],
    ['dealer_members', { status: 'REMOVED', role: 'MANAGER' }],
    ['dealer_members', { status: 'INVITED', role: 'MANAGER' }],
    ['users', { status: 'SUSPENDED' }],
    ['users', { status: 'DELETED' }],
    ['user_roles', { status: 'SUSPENDED' }],
  ] as const)('denies inactive %s authority %j', async (table, row) => {
    const { tx } = database({ [table]: [row] });
    await expect(authorizeDealerWrite(tx, actor, 'listing:submit')).rejects.toMatchObject({
      status: 401,
    });
  });

  it.each(['DRAFT', 'PENDING_APPROVAL'])(
    'permits draft preparation for %s but prohibits lifecycle writes',
    async (status) => {
      const { tx } = database({ dealers: [{ status }] });
      await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).resolves.toContain(
        'vehicle:write',
      );
      await expect(authorizeDealerWrite(tx, actor, 'listing:submit', true)).rejects.toMatchObject({
        status: 403,
        code: 'DEALER_NOT_ACTIVE',
      });
    },
  );

  it('uses a freshly downgraded STAFF role instead of earlier managerial permissions', async () => {
    const { tx } = database({ dealer_members: [{ status: 'ACTIVE', role: 'STAFF' }] });
    await expect(authorizeDealerWrite(tx, actor, 'listing:submit')).rejects.toMatchObject({
      status: 403,
    });
    const permissions = await authorizeDealerWrite(tx, actor, 'vehicle:write');
    expect(permissions).not.toContain('vehicle:delete');
  });

  it.each([
    { ...session, userId: 'foreign-user' },
    { ...session, scope: 'ADMIN' },
    { ...session, revokedAt: new Date() },
    { ...session, expiresAt: new Date(Date.now() - 1000) },
  ])('denies a mismatched, admin, revoked or expired session', async (row) => {
    const { tx } = database({ sessions: [row] });
    await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('permits a customer-scope session with the actual dealership membership', async () => {
    const { tx } = database({ sessions: [{ ...session, scope: 'CUSTOMER' }] });
    await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).resolves.toContain(
      'vehicle:write',
    );
  });

  it('keeps dev identity checks without requiring a cookie session', async () => {
    const { tx, query } = database();
    await authorizeDealerWrite(
      tx,
      { dealerId: actor.dealerId, userId: actor.userId },
      'vehicle:write',
    );
    expect(query.mock.calls.some(([sql]) => sql.sql.includes('"sessions"'))).toBe(false);
  });

  it('protects an absent neutral seat against concurrent insertion by upgrading the user lock', async () => {
    const { tx, query } = database({ user_roles: [] });
    await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).resolves.toContain(
      'vehicle:write',
    );
    expect(
      query.mock.calls.some(
        ([sql]) => sql.sql.includes('"users"') && sql.sql.includes('FOR UPDATE SKIP LOCKED'),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.filter(
        ([sql]) => sql.sql.includes('"user_roles"') && sql.sql.includes('FOR SHARE'),
      ).length,
    ).toBe(2);
  });

  it.each(['dealers', 'dealer_members', 'users', 'user_roles', 'sessions'])(
    'fails closed on a locked %s row rather than treating it as absent',
    async (table) => {
      const { tx, query } = database();
      const original = query.getMockImplementation();
      query.mockImplementation(async (sql) => {
        if (sql.sql.includes(`FROM "${table}"`))
          return sql.sql.includes('SKIP LOCKED') ? [] : [{ id: 'existing' }];
        return (await original?.(sql)) ?? [];
      });
      await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).rejects.toMatchObject({
        status: 409,
        code: 'AUTHORIZATION_BUSY',
      });
    },
  );

  it('rechecks a seat inserted before the exclusive user lock is acquired', async () => {
    const { tx, query } = database();
    const original = query.getMockImplementation();
    let seatReads = 0;
    query.mockImplementation(async (sql) => {
      if (sql.sql.includes('FROM "user_roles"')) {
        if (sql.sql.includes('FOR SHARE')) {
          seatReads += 1;
          return seatReads === 1 ? [] : [{ status: 'SUSPENDED' }];
        }
        return [];
      }
      return (await original?.(sql)) ?? [];
    });
    await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('does not suppress database failures or turn them into authorization grants', async () => {
    const { tx, query } = database();
    const failure = new Error('Database unavailable');
    query.mockRejectedValueOnce(failure);
    await expect(authorizeDealerWrite(tx, actor, 'vehicle:write')).rejects.toBe(failure);
  });
});
