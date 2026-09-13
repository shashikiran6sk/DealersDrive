import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  ensureSeat,
  isSeatSuspended,
  seatSuspensionReason,
  setSeatStatus,
} from '../../../../src/modules/auth/roles.js';

/**
 * Unit tests for `src/modules/auth/roles.ts` — per-role seats (**R41**).
 *
 * The bug this module exists to fix was invisible in every test that ran
 * before it: suspending a dealership wrote `users.status`, which is the whole
 * account, so a member who also moderated the platform lost the admin console
 * as a side effect. What follows pins the two properties that keep that from
 * coming back — a seat refuses only its own role, and nothing here ever
 * reopens one.
 */
function db() {
  const upsert = vi.fn(() => Promise.resolve({}));
  const createMany = vi.fn(() => Promise.resolve({ count: 0 }));
  const updateMany = vi.fn(() => Promise.resolve({ count: 0 }));

  return {
    prisma: { userRole: { upsert, createMany, updateMany } } as unknown as PrismaClient,
    upsert,
    createMany,
    updateMany,
  };
}

describe('isSeatSuspended', () => {
  it('refuses a role whose seat is closed', () => {
    expect(isSeatSuspended([{ role: 'DEALER', status: 'SUSPENDED' }], 'DEALER')).toBe(true);
  });

  /** The whole point: one closed seat says nothing about the other. */
  it('leaves the other seat open', () => {
    const seats = [
      { role: 'DEALER' as const, status: 'SUSPENDED' as const },
      { role: 'ADMIN' as const, status: 'ACTIVE' as const },
    ];

    expect(isSeatSuspended(seats, 'DEALER')).toBe(true);
    expect(isSeatSuspended(seats, 'ADMIN')).toBe(false);
  });

  /**
   * An absent row says nothing. That is what makes the table safe to introduce
   * beneath checks that already exist — it can close a door, never open one.
   */
  it('treats a missing seat as no answer, not as a refusal', () => {
    expect(isSeatSuspended([], 'ADMIN')).toBe(false);
    expect(isSeatSuspended([{ role: 'DEALER', status: 'ACTIVE' }], 'ADMIN')).toBe(false);
  });
});

describe('seatSuspensionReason', () => {
  it('returns the words the person is shown', () => {
    expect(
      seatSuspensionReason(
        [{ role: 'DEALER', status: 'SUSPENDED', reason: 'GST registration has expired.' }],
        'DEALER',
      ),
    ).toBe('GST registration has expired.');
  });

  it('is null for an open seat', () => {
    expect(seatSuspensionReason([{ role: 'ADMIN', status: 'ACTIVE' }], 'ADMIN')).toBeNull();
  });
});

describe('ensureSeat', () => {
  /**
   * The empty `update` is the assertion. A sign-in that reopened a closed seat
   * would make a suspension last exactly as long as it took the dealer to press
   * the button again.
   */
  it('creates a seat without touching one that already exists', async () => {
    const h = db();

    await ensureSeat(h.prisma, { userId: 'user-1', role: 'DEALER' });

    expect(h.upsert).toHaveBeenCalledExactlyOnceWith({
      where: { userId_role: { userId: 'user-1', role: 'DEALER' } },
      create: { userId: 'user-1', role: 'DEALER', grantedBy: null },
      update: {},
    });
  });

  it('records the admin who granted the seat, where one did', async () => {
    const h = db();

    await ensureSeat(h.prisma, { userId: 'user-2', role: 'ADMIN', grantedBy: 'admin-1' });

    expect(h.upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { grantedBy: 'admin-1' },
    });
  });
});

describe('setSeatStatus', () => {
  it('closes the seats of everybody named, with the reason', async () => {
    const h = db();

    await setSeatStatus(h.prisma, {
      userIds: ['owner-1', 'manager-1'],
      role: 'DEALER',
      status: 'SUSPENDED',
      reason: 'GST registration has expired.',
    });

    // The create covers a member who has never signed in and so has no row.
    expect(h.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        { userId: 'owner-1', role: 'DEALER' },
        { userId: 'manager-1', role: 'DEALER' },
      ],
      skipDuplicates: true,
    });
    expect(h.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: { in: ['owner-1', 'manager-1'] }, role: 'DEALER' },
      data: {
        status: 'SUSPENDED',
        reason: 'GST registration has expired.',
        suspendedAt: expect.any(Date),
      },
    });
  });

  it('clears the reason and the date when it reopens one', async () => {
    const h = db();

    await setSeatStatus(h.prisma, { userIds: ['owner-1'], role: 'DEALER', status: 'ACTIVE' });

    expect(h.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: { in: ['owner-1'] }, role: 'DEALER' },
      data: { status: 'ACTIVE', reason: null, suspendedAt: null },
    });
  });

  /** A dealership with no members is not an error, and not a write either. */
  it('writes nothing for an empty list', async () => {
    const h = db();

    await setSeatStatus(h.prisma, { userIds: [], role: 'DEALER', status: 'SUSPENDED' });

    expect(h.createMany).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
