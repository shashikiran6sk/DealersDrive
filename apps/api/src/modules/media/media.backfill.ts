import type { PrismaClient } from '@prisma/client';

import { PROCESSED_OWNERS, type MediaProcessor, type ProcessOutcome } from './media.processor.js';

export interface BackfillDeps {
  prisma: PrismaClient;
  processor: Pick<MediaProcessor, 'process'>;
  dryRun: boolean;
  write: (line: string) => void;
}

export type BackfillCounts = Record<ProcessOutcome, number> & { pending: number };

const OUTCOME_MARK: Record<ProcessOutcome, string> = {
  processed: '✓',
  skipped: '·',
  unreadable: '✗',
};

export async function backfillVehicleMedia({
  prisma,
  processor,
  dryRun,
  write,
}: BackfillDeps): Promise<BackfillCounts> {
  const pending = await prisma.media.findMany({
    where: { status: 'READY', ownerType: { in: [...PROCESSED_OWNERS] }, variants: { equals: {} } },
    select: { id: true, storageKey: true },
    orderBy: { createdAt: 'asc' },
  });
  const counts: BackfillCounts = {
    pending: pending.length,
    processed: 0,
    skipped: 0,
    unreadable: 0,
  };

  write(
    `${String(pending.length)} vehicle photograph(s) without derivatives${dryRun ? ' (dry run)' : ''}`,
  );
  if (dryRun) {
    for (const media of pending) write(`  ·  ${media.id}  ${media.storageKey}`);
    return counts;
  }

  for (const [index, media] of pending.entries()) {
    const outcome = await processor.process(media.id);
    counts[outcome] += 1;
    write(
      `  ${OUTCOME_MARK[outcome]}  ${String(index + 1)}/${String(pending.length)}  ${media.id}  ${outcome}`,
    );
  }

  write(
    `${String(counts.processed)} processed, ${String(counts.skipped)} skipped, ` +
      `${String(counts.unreadable)} could not be read.`,
  );
  return counts;
}
