import type { Prisma, PrismaClient } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';

const imageInclude = { media: true } satisfies Prisma.VehicleMediaInclude;

export type ImageRow = Prisma.VehicleMediaGetPayload<{ include: typeof imageInclude }>;

type Db = PrismaClient | Tx;

export function imagesOf(db: Db, vehicleId: string): Promise<ImageRow[]> {
  return db.vehicleMedia.findMany({
    where: { vehicleId },
    include: imageInclude,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
}

export function imageCount(db: Db, vehicleId: string): Promise<number> {
  return db.vehicleMedia.count({ where: { vehicleId } });
}

export async function renumber(tx: Tx, order: string[]): Promise<void> {
  for (const [position, id] of order.entries()) {
    await tx.vehicleMedia.update({ where: { id }, data: { position } });
  }
}
