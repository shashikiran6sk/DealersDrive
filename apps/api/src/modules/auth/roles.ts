import type { PlatformRole, Prisma, PrismaClient, UserRoleStatus } from '@prisma/client';

/**
 * Per-role seats — who may enter which console (**R41**).
 *
 * `users.status` is the account: one switch for the whole person, every door.
 * This module is the per-seat layer beneath it, and the split exists because
 * one human can be two things. A dealership owner who also moderates the
 * platform holds a DEALER seat and an ADMIN seat; suspending their dealership
 * is a decision about a yard, and it must not take the operations console with
 * it.
 *
 * **The rule, in one sentence:** a seat row refuses its role when it is
 * `SUSPENDED`, and an absent row says nothing. It can only close a door, never
 * open one — which is what makes this table safe to introduce beneath checks
 * that already exist (the dealership's own status, `isPlatformAdmin`, the admin
 * allow-list). Those still decide; this is a veto laid over them.
 */

/** A `PrismaClient` or a transaction handle — every helper here takes either. */
type Db = PrismaClient | Prisma.TransactionClient;

/** The shape a seat is read in. Nothing here needs the whole row. */
export interface RoleSeat {
  role: PlatformRole;
  status: UserRoleStatus;
  reason?: string | null;
  /**
   * The admin who handed the seat over, where one did (**R42**).
   *
   * Null for a seat the product created on its own — `ensureSeat` writes one on
   * every sign-in. That distinction is load-bearing for the admin console: see
   * `hasGrantedSeat` below.
   */
  grantedBy?: string | null;
}

/**
 * Is this seat closed?
 *
 * Pure, and given the seats already loaded rather than a database handle: the
 * session resolver reads `user.roles` in the same query that reads the session,
 * so asking this question costs nothing per request.
 */
export function isSeatSuspended(seats: readonly RoleSeat[], role: PlatformRole): boolean {
  return seats.some((seat) => seat.role === role && seat.status === 'SUSPENDED');
}

/** The reason a seat was closed, for the message the person is shown. */
export function seatSuspensionReason(
  seats: readonly RoleSeat[],
  role: PlatformRole,
): string | null {
  const seat = seats.find((entry) => entry.role === role && entry.status === 'SUSPENDED');
  return seat?.reason ?? null;
}

/**
 * Is this seat one an admin **granted** (**R42**)?
 *
 * Deliberately not "does an active seat exist". Every admin sign-in leaves an
 * ADMIN seat behind, so existence means only "has signed in once" — and reading
 * it as permission would make `ADMIN_ALLOWLIST` vacuous: an address taken off
 * the list would keep working forever on the strength of its own last visit.
 *
 * `grantedBy` is set by exactly one thing, `grantSeat`, called by exactly one
 * caller: a SUPER_ADMIN on the settings screen. That is what makes it an
 * authorization fact rather than a footprint.
 */
export function hasGrantedSeat(seats: readonly RoleSeat[], role: PlatformRole): boolean {
  return seats.some(
    (seat) =>
      seat.role === role &&
      seat.status === 'ACTIVE' &&
      seat.grantedBy !== null &&
      seat.grantedBy !== undefined,
  );
}

/**
 * Record that somebody holds a seat, without disturbing one they already have.
 *
 * Called on every successful sign-in, which is what makes the table complete
 * for anyone the product has actually seen — and deliberately an *upsert with
 * an empty update*: a DEALER seat closed by a suspension must not be reopened
 * by the act of signing in, or the suspension would last exactly as long as it
 * took the dealer to press the button again.
 */
export async function ensureSeat(
  db: Db,
  input: { userId: string; role: PlatformRole; grantedBy?: string | null },
): Promise<void> {
  await db.userRole.upsert({
    where: { userId_role: { userId: input.userId, role: input.role } },
    create: {
      userId: input.userId,
      role: input.role,
      grantedBy: input.grantedBy ?? null,
    },
    update: {},
  });
}

/**
 * Close or reopen a seat for several people at once — what a dealership
 * suspension does to its members.
 *
 * The two writes are one logical operation and both are needed: `createMany`
 * covers a member who has never signed in and so has no row, `updateMany` the
 * ones who have. Ordering matters only in that the create must come first.
 */
export async function setSeatStatus(
  db: Db,
  input: {
    userIds: readonly string[];
    role: PlatformRole;
    status: UserRoleStatus;
    reason?: string | null;
  },
): Promise<void> {
  if (input.userIds.length === 0) return;

  await db.userRole.createMany({
    data: input.userIds.map((userId) => ({ userId, role: input.role })),
    skipDuplicates: true,
  });

  await db.userRole.updateMany({
    where: { userId: { in: [...input.userIds] }, role: input.role },
    data:
      input.status === 'SUSPENDED'
        ? { status: 'SUSPENDED', reason: input.reason ?? null, suspendedAt: new Date() }
        : { status: 'ACTIVE', reason: null, suspendedAt: null },
  });
}

/**
 * Hand a seat over deliberately (**R42**).
 *
 * The difference from `ensureSeat` is `grantedBy`, and it is the whole
 * difference: this is an authorization fact — somebody decided — where the
 * other is a footprint. It also **reopens** a closed seat, because granting
 * access to somebody whose access was withdrawn is the same act as granting it
 * the first time, and a SUPER_ADMIN is doing both on purpose.
 */
export async function grantSeat(
  db: Db,
  input: { userId: string; role: PlatformRole; grantedBy: string },
): Promise<{ grantedAt: Date }> {
  return db.userRole.upsert({
    where: { userId_role: { userId: input.userId, role: input.role } },
    create: { userId: input.userId, role: input.role, grantedBy: input.grantedBy },
    update: {
      status: 'ACTIVE',
      reason: null,
      suspendedAt: null,
      grantedBy: input.grantedBy,
      grantedAt: new Date(),
    },
  });
}
