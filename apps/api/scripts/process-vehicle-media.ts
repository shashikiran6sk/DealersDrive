/**
 * Writes the 320 / 640 / 1024 / 1600 WebP derivatives for every vehicle
 * photograph that does not have them yet (**F034**).
 *
 *     pnpm --filter @dealers-drive/api media:process -- --dry-run
 *     pnpm --filter @dealers-drive/api media:process
 *
 * ── Why a script ────────────────────────────────────────────────────────────
 * New uploads are resized by the `media.process` job the moment an admin
 * commits them. Every photograph committed before that job existed has an
 * empty `variants` map, so `GET /media/by-media/:id/:width.webp` falls back to
 * the camera original for every width — a 15-megapixel file behind a URL that
 * says `320`. This walks those rows once.
 *
 * It calls the same `process()` the job does, so it skips anything already
 * resized, anything not `READY` and anything that is not a vehicle photograph.
 * Running it twice is safe: the second run finds nothing to do.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';
import { createMediaProcessor, PROCESSED_OWNERS } from '../src/modules/media/media.processor.js';
import { createInlineQueue } from '../src/platform/jobs/queue.js';
import { createStorage } from '../src/platform/storage/factory.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const processor = createMediaProcessor({
  prisma,
  storage: createStorage(),
  queue: createInlineQueue(),
});
const dryRun = process.argv.includes('--dry-run');

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const pending = await prisma.media.findMany({
    where: { status: 'READY', ownerType: { in: [...PROCESSED_OWNERS] }, variants: { equals: {} } },
    select: { id: true, storageKey: true, bytes: true },
    orderBy: { createdAt: 'asc' },
  });

  log(
    `\n${String(pending.length)} vehicle photograph(s) without derivatives` +
      `${dryRun ? '  (dry run)' : ''}\n`,
  );
  if (dryRun) {
    for (const media of pending) log(`  ·  ${media.id}  ${media.storageKey}`);
    return;
  }

  const counts = { processed: 0, skipped: 0, unreadable: 0 };
  for (const [index, media] of pending.entries()) {
    const outcome = await processor.process(media.id);
    counts[outcome] += 1;
    const mark = outcome === 'processed' ? '✓' : outcome === 'skipped' ? '·' : '✗';
    log(`  ${mark}  ${String(index + 1)}/${String(pending.length)}  ${media.id}  ${outcome}`);
  }

  log(
    `\n${String(counts.processed)} processed, ${String(counts.skipped)} skipped, ` +
      `${String(counts.unreadable)} could not be read.\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nmedia processing failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
