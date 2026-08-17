import type { PrismaClient } from '@prisma/client';

import type { Tx } from './prisma.js';

/**
 * Runs a unit of work with the tenant stamped on the transaction.
 *
 * `SET LOCAL app.dealer_id` is what the row-level-security policies in
 * `prisma/rls.sql` read. Those policies are the fourth backstop behind
 * session-derived context, repository signatures and tests (ARCHITECTURE §7);
 * they are applied separately because creating the two database roles needs
 * privileges a migration should not assume. The `SET LOCAL` is issued
 * unconditionally so switching RLS on is a database change, not a code change.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  dealerId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.dealer_id = '${assertUuid(dealerId)}'`);
    return work(tx);
  });
}

/** Plain transaction for platform work that legitimately spans tenants. */
export async function withTransaction<T>(
  prisma: PrismaClient,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => work(tx));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `SET LOCAL` cannot be parameterised, so the value is interpolated — and is
 * therefore checked against the UUID grammar first. The id always comes from
 * the session, never from a client, but a guard that costs one regex is worth
 * having on the one line in the codebase that concatenates SQL.
 */
function assertUuid(value: string): string {
  if (!UUID.test(value)) {
    throw new Error(`Refusing to set a non-uuid tenant id: ${value}`);
  }
  return value;
}
