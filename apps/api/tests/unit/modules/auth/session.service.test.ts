import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAST_SEEN_REFRESH_MS,
  createSessionService,
} from '../../../../src/modules/auth/session.service.js';

/**
 * `lastSeenAt` is what the admin overview counts people by, so it has to move
 * when someone comes back — but at most once an hour, so that browsing never
 * turns every read into a write.
 */

const NOW = new Date('2026-11-02T10:00:00.000Z');

function setup(
  row: { id: string; lastSeenAt: Date } | null,
  options: { failWrite?: boolean } = {},
) {
  const updates: { where: unknown; data: unknown }[] = [];
  const prisma = {
    session: {
      findFirst: () => Promise.resolve(row ? { ...row, user: { roles: [] } } : null),
      updateMany: (args: { where: unknown; data: unknown }) => {
        updates.push(args);
        return options.failWrite
          ? Promise.reject(new Error('database unavailable'))
          : Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaClient;

  return { sessions: createSessionService(prisma), updates };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('session last-seen', () => {
  it('records a visit when the session was last seen over an hour ago', async () => {
    const stale = new Date(NOW.getTime() - LAST_SEEN_REFRESH_MS - 1);
    const h = setup({ id: 'session-1', lastSeenAt: stale });

    await h.sessions.resolvePerson('token');

    expect(h.updates).toEqual([
      { where: { id: 'session-1', lastSeenAt: stale }, data: { lastSeenAt: NOW } },
    ]);
  });

  it('does not write again within the hour', async () => {
    const recent = new Date(NOW.getTime() - LAST_SEEN_REFRESH_MS + 1000);
    const h = setup({ id: 'session-1', lastSeenAt: recent });

    await h.sessions.resolve('token', 'DEALER');

    expect(h.updates).toEqual([]);
  });

  it('refreshes admin sessions through resolve as well', async () => {
    const stale = new Date(NOW.getTime() - 2 * LAST_SEEN_REFRESH_MS);
    const h = setup({ id: 'session-2', lastSeenAt: stale });

    await h.sessions.resolve('token', 'ADMIN');

    expect(h.updates).toHaveLength(1);
  });

  it('writes nothing when the token resolves to no session', async () => {
    const h = setup(null);

    expect(await h.sessions.resolvePerson('token')).toBeNull();
    expect(h.updates).toEqual([]);
  });

  it('still admits the request when the refresh fails', async () => {
    const stale = new Date(NOW.getTime() - 2 * LAST_SEEN_REFRESH_MS);
    const h = setup({ id: 'session-1', lastSeenAt: stale }, { failWrite: true });

    await expect(h.sessions.resolvePerson('token')).resolves.toMatchObject({ id: 'session-1' });
  });
});
