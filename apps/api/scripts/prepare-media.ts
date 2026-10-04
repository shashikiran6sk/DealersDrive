import { writeDerivatives } from '../src/platform/media/derivatives.js';
import { createPrisma } from '../src/platform/db/prisma.js';
import { createStorage } from '../src/platform/storage/factory.js';

// Run before exposing imported media. New commit paths prepare images before
// marking them READY; this repairs older rows without exposing originals.
const prisma = createPrisma();
const storage = createStorage();
try {
  let cursor: string | undefined;
  while (true) {
    const rows = await prisma.media.findMany({
      where: { status: 'READY', ownerType: { in: ['VEHICLE', 'DEALER_COVER'] } },
      orderBy: { id: 'asc' },
      take: 20,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (row.variants && typeof row.variants === 'object' && '1600' in row.variants) continue;
      const body = await storage.get(row.storageKey);
      if (!body) throw new Error(`Missing original for media ${row.id}`);
      const variants = await writeDerivatives(row.id, body, storage);
      await prisma.media.update({ where: { id: row.id }, data: { variants } });
      console.warn(`Prepared ${row.id}`);
    }
    cursor = rows.at(-1)?.id;
  }
} finally {
  await prisma.$disconnect();
}
