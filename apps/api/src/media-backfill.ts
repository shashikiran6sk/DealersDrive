import process from 'node:process';

import { backfillVehicleMedia } from './modules/media/media.backfill.js';
import { createMediaProcessor } from './modules/media/media.processor.js';
import { createPrisma } from './platform/db/prisma.js';
import { createInlineQueue } from './platform/jobs/queue.js';
import { createStorage } from './platform/storage/factory.js';

const prisma = createPrisma();

try {
  await backfillVehicleMedia({
    prisma,
    processor: createMediaProcessor({
      prisma,
      storage: createStorage(),
      queue: createInlineQueue(),
    }),
    dryRun: process.argv.includes('--dry-run'),
    write: (line) => process.stdout.write(`${line}\n`),
  });
} catch (error) {
  process.stderr.write(`media backfill failed: ${String(error)}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
