import type { PlatformRole, Prisma, PrismaClient, UserRoleStatus } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface RoleSeat {
  role: PlatformRole;
  status: UserRoleStatus;
  reason?: string | null;
  grantedBy?: string | null;
}

export function isSeatSuspended(seats: readonly RoleSeat[], role: PlatformRole): boolean {
  return seats.some((seat) => seat.role === role && seat.status === 'SUSPENDED');
}

export function seatSuspensionReason(
  seats: readonly RoleSeat[],
  role: PlatformRole,
): string | null {
  const seat = seats.find((entry) => entry.role === role && entry.status === 'SUSPENDED');
  return seat?.reason ?? null;
}

export function hasGrantedSeat(seats: readonly RoleSeat[], role: PlatformRole): boolean {
  return seats.some(
    (seat) =>
      seat.role === role &&
      seat.status === 'ACTIVE' &&
      seat.grantedBy !== null &&
      seat.grantedBy !== undefined,
  );
}

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
