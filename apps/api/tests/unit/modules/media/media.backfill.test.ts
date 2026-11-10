import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { backfillMedia } from '../../../../src/modules/media/media.backfill.js';
import type { ProcessOutcome } from '../../../../src/modules/media/media.processor.js';

/**
 * Unit tests for `src/modules/media/media.backfill.ts` (**F034**).
 *
 * The one-off pass that resizes every public photograph uploaded before the
 * `media.process` job existed. What is pinned: which rows it asks for, that a
 * dry run touches nothing, and that it reports every outcome.
 */
const ROWS = [
  { id: 'm-1', storageKey: 'vehicles/v/m-1/original.jpg' },
  { id: 'm-2', storageKey: 'vehicles/v/m-2/original.jpg' },
  { id: 'm-3', storageKey: 'vehicles/v/m-3/original.jpg' },
];

function setup(outcomes: ProcessOutcome[] = ['processed', 'skipped', 'unreadable']) {
  const findMany = vi.fn(() => Promise.resolve(ROWS));
  const prisma = { media: { findMany } } as unknown as PrismaClient;
  const process = vi.fn((id: string) =>
    Promise.resolve(outcomes[ROWS.findIndex((row) => row.id === id)] ?? 'processed'),
  );
  const lines: string[] = [];
  return { prisma, findMany, process, lines, write: (line: string) => lines.push(line) };
}

describe('backfillMedia', () => {
  it('asks only for READY public photographs that have no derivatives yet, oldest first', async () => {
    const { prisma, findMany, process, write } = setup();

    await backfillMedia({ prisma, processor: { process }, dryRun: true, write });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: 'READY',
        ownerType: { in: ['VEHICLE', 'DEALER_PORTFOLIO', 'DEALER_COVER'] },
        variants: { equals: {} },
      },
      select: { id: true, storageKey: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('lists what it would do on a dry run, and processes nothing', async () => {
    const { prisma, process, lines, write } = setup();

    const counts = await backfillMedia({
      prisma,
      processor: { process },
      dryRun: true,
      write,
    });

    expect(process).not.toHaveBeenCalled();
    expect(counts).toEqual({ pending: 3, processed: 0, skipped: 0, unreadable: 0 });
    expect(lines).toEqual([
      '3 photograph(s) without derivatives (dry run)',
      '  ·  m-1  vehicles/v/m-1/original.jpg',
      '  ·  m-2  vehicles/v/m-2/original.jpg',
      '  ·  m-3  vehicles/v/m-3/original.jpg',
    ]);
  });

  it('processes each in turn and counts every outcome', async () => {
    const { prisma, process, lines, write } = setup();

    const counts = await backfillMedia({
      prisma,
      processor: { process },
      dryRun: false,
      write,
    });

    expect(process.mock.calls.map(([id]) => id)).toEqual(['m-1', 'm-2', 'm-3']);
    expect(counts).toEqual({ pending: 3, processed: 1, skipped: 1, unreadable: 1 });
    expect(lines).toEqual([
      '3 photograph(s) without derivatives',
      '  ✓  1/3  m-1  processed',
      '  ·  2/3  m-2  skipped',
      '  ✗  3/3  m-3  unreadable',
      '1 processed, 1 skipped, 1 could not be read.',
    ]);
  });
});
