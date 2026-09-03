import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

/**
 * Creates and prepares `dealersdrive_test` once per run.
 *
 * The suite needs the migrations *and* the seed: the seed is where the second
 * dealer comes from, and "Dealer A cannot reach Dealer B's rows" is not a test
 * you can write with one dealer in the database.
 *
 * The DDL goes through Prisma rather than `psql`, which is not necessarily on
 * the host — the database may well be running inside a container.
 */
const TEST_URL = 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_test';
const ADMIN_URL = 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive';

function run(command: string, args: string[]): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_URL, NODE_ENV: 'test', JOBS_ENABLED: 'false' },
  });
}

export async function setup(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

  try {
    // Dropped and recreated each run: a suite that starts from whatever the
    // last one left behind is a suite that passes for the wrong reasons.
    // `CREATE DATABASE` cannot run inside a transaction, hence the unsafe
    // (unparameterised) form — the identifier here is a constant, not input.
    await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS dealersdrive_test');
    await admin.$executeRawUnsafe('CREATE DATABASE dealersdrive_test');
  } finally {
    await admin.$disconnect();
  }

  run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);
  run('pnpm', ['exec', 'tsx', 'prisma/seed/index.ts']);
}

export async function teardown(): Promise<void> {
  // Left in place on purpose: after a failure the database is the evidence.
  await Promise.resolve();
}
