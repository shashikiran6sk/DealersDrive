import type { PrismaClient } from '@prisma/client';

import type { Tx } from './prisma.js';

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

export async function withTransaction<T>(
  prisma: PrismaClient,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => work(tx));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string): string {
  if (!UUID.test(value)) {
    throw new Error(`Refusing to set a non-uuid tenant id: ${value}`);
  }
  return value;
}
