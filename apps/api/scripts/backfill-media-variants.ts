/**
 * Writes the 320/640/1024/1600 WebP derivatives for READY images that have none.
 *
 *     pnpm --filter @dealers-drive/api media:backfill -- --dry-run
 *     pnpm --filter @dealers-drive/api media:backfill
 *     pnpm --filter @dealers-drive/api media:backfill -- --all
 *
 * In production, run it from the migrator image (it keeps `tsx`) with the API's
 * environment, the same way `db:bootstrap` runs.
 *
 * ── Why a script ────────────────────────────────────────────────────────────
 * Derivatives are rendered by the `media.process` job, which a `MediaUploaded`
 * event starts when an image is committed. Every image committed before that
 * job existed has `variants = {}`, and the public route serves those as the
 * full-size original. Nothing will ever announce them again, so this walks them
 * once, calling the same `process()` the job calls.
 *
 * By default it only touches rows whose `variants` is empty. `--all` re-renders
 * every READY image, which is what to run after changing the widths or the
 * WebP quality. It is safe to re-run: the keys are deterministic, a re-render
 * overwrites them, and a row replaced while it ran is left alone.
 *
 * A browser that cached an original revalidates against an ETag derived from
 * the object key, so once the variant exists the next revalidation downloads
 * the variant. No cache needs purging.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';
import { createMediaProcessor } from '../src/modules/media/media.processor.js';
import { createStorage } from '../src/platform/storage/factory.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const processor = createMediaProcessor({ prisma, storage: createStorage() });
const dryRun = process.argv.includes('--dry-run');
const all = process.argv.includes('--all');

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const ids = await processor.unprocessed({ all });
  log(
    `\n${String(ids.length)} READY image(s)${all ? '' : ' without derivatives'}` +
      `${dryRun ? '  (dry run)' : ''}\n`,
  );
  if (dryRun) {
    for (const id of ids) log(`  ${id}`);
    return;
  }

  const tally = new Map<string, number>();
  for (const [index, id] of ids.entries()) {
    const outcome = await processor.process(id, { force: all });
    tally.set(outcome, (tally.get(outcome) ?? 0) + 1);
    log(`  [${String(index + 1)}/${String(ids.length)}] ${id}  ${outcome}`);
  }

  const summary = [...tally.entries()].map(([outcome, count]) => `${String(count)} ${outcome}`);
  log(`\n${summary.length > 0 ? summary.join(', ') : 'nothing to do'}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\nbackfill failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
