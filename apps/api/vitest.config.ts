import { defineConfig } from 'vitest/config';

/**
 * The integration suite runs against a **real PostgreSQL database** — a
 * separate `dealersdrive_test` schema, migrated and seeded by `global-setup`.
 *
 * That is deliberate. Every invariant worth testing here lives in the database:
 * the `FOR UPDATE` that serialises credit movements, the partial unique index
 * that permits one approved listing per vehicle, the `listing_search`
 * visibility rule. A mocked Prisma would test the mock.
 *
 * Files run one at a time, in one fork: they share that database, and a
 * parallel run would have two suites moving the same dealer's credits.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    // One worker, one connection pool, one sequence of credit movements.
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_test',
      // pg-boss off: the suite drives handlers directly where it needs them,
      // and a background poller against the test database is just noise.
      JOBS_ENABLED: 'false',
      WORKER_INLINE: 'false',
      // The limits are exercised by their own test, which enables them locally.
      RATE_LIMIT_ENABLED: 'false',
      LOG_LEVEL: 'silent',
      STORAGE_LOCAL_DIR: '.storage-test',
    },
  },
});
