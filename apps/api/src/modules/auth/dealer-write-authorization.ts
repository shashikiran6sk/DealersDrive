import type { DealerPermission } from '@dealers-drive/contracts';
import { Prisma, type DealerRole, type DealerStatus, type MemberStatus } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../platform/errors.js';
import { permissionsForRole } from './session.port.js';

export interface DealerWriteActor {
  dealerId: string;
  userId: string;
  sessionId?: string;
}

async function lockedRow<T>(tx: Tx, lock: Prisma.Sql, exists: Prisma.Sql): Promise<T | null> {
  const rows = await tx.$queryRaw<T[]>(lock);
  if (rows[0]) return rows[0];
  if ((await tx.$queryRaw<unknown[]>(exists)).length > 0) {
    throw new ConflictError('AUTHORIZATION_BUSY', 'Another operation is in progress. Try again.');
  }
  return null;
}

export async function authorizeDealerWrite(
  tx: Tx,
  actor: DealerWriteActor,
  permission: DealerPermission,
  requireActive = false,
): Promise<string[]> {
  const dealer = await lockedRow<{ status: DealerStatus }>(
    tx,
    Prisma.sql`SELECT "status" FROM "dealers" WHERE "id"=${actor.dealerId}::uuid FOR SHARE SKIP LOCKED`,
    Prisma.sql`SELECT "id" FROM "dealers" WHERE "id"=${actor.dealerId}::uuid`,
  );
  if (!dealer || dealer.status === 'SUSPENDED' || dealer.status === 'CLOSED') {
    throw new UnauthorizedError();
  }

  const member = await lockedRow<{ status: MemberStatus; role: DealerRole }>(
    tx,
    Prisma.sql`SELECT "status","role" FROM "dealer_members"
      WHERE "dealerId"=${actor.dealerId}::uuid AND "userId"=${actor.userId}::uuid FOR SHARE SKIP LOCKED`,
    Prisma.sql`SELECT "id" FROM "dealer_members"
      WHERE "dealerId"=${actor.dealerId}::uuid AND "userId"=${actor.userId}::uuid`,
  );
  if (!member || member.status !== 'ACTIVE') throw new UnauthorizedError();

  const user = await lockedRow<{ status: string }>(
    tx,
    Prisma.sql`SELECT "status" FROM "users" WHERE "id"=${actor.userId}::uuid FOR SHARE SKIP LOCKED`,
    Prisma.sql`SELECT "id" FROM "users" WHERE "id"=${actor.userId}::uuid`,
  );
  if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError();

  const seatLock = Prisma.sql`SELECT "status" FROM "user_roles"
    WHERE "userId"=${actor.userId}::uuid AND "role"='DEALER' FOR SHARE SKIP LOCKED`;
  const seatExists = Prisma.sql`SELECT "id" FROM "user_roles"
    WHERE "userId"=${actor.userId}::uuid AND "role"='DEALER'`;
  let seat = await lockedRow<{ status: string }>(tx, seatLock, seatExists);
  if (!seat) {
    await lockedRow<{ status: string }>(
      tx,
      Prisma.sql`SELECT "status" FROM "users" WHERE "id"=${actor.userId}::uuid FOR UPDATE SKIP LOCKED`,
      Prisma.sql`SELECT "id" FROM "users" WHERE "id"=${actor.userId}::uuid`,
    );
    seat = await lockedRow<{ status: string }>(tx, seatLock, seatExists);
  }
  if (seat?.status === 'SUSPENDED') throw new UnauthorizedError();

  if (actor.sessionId) {
    const session = await lockedRow<{
      userId: string;
      scope: string;
      revokedAt: Date | null;
      expiresAt: Date;
    }>(
      tx,
      Prisma.sql`SELECT "userId","scope","revokedAt","expiresAt" FROM "sessions"
        WHERE "id"=${actor.sessionId}::uuid FOR SHARE SKIP LOCKED`,
      Prisma.sql`SELECT "id" FROM "sessions" WHERE "id"=${actor.sessionId}::uuid`,
    );
    if (
      !session ||
      session.userId !== actor.userId ||
      !['DEALER', 'CUSTOMER'].includes(session.scope) ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedError();
    }
  }

  const permissions = permissionsForRole(member.role);
  if (!permissions.includes(permission)) {
    throw new ForbiddenError(`This action needs the ${permission} permission.`);
  }
  if (requireActive && dealer.status !== 'ACTIVE') {
    throw new ForbiddenError(
      'Your dealership is not active yet. Listings can be published once our team approves it.',
      { code: 'DEALER_NOT_ACTIVE' },
    );
  }
  return permissions;
}
