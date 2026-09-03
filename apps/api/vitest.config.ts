import { defineConfig } from 'vitest/config';

/**
 * Two suites, deliberately separated, because they have opposite requirements.
 *
 * **integration** (`tests/*.test.ts`) runs against a **real PostgreSQL
 * database** — a separate `dealersdrive_test` schema, migrated and seeded by
 * `global-setup`. Every invariant worth testing there lives in the database: the
 * `FOR UPDATE` that serialises credit movements, the partial unique index that
 * permits one approved listing per vehicle, the `listing_search` visibility
 * rule. A mocked Prisma would test the mock. Those files run one at a time, in
 * one fork: they share that database, and a parallel run would have two suites
 * moving the same dealer's credits.
 *
 * **unit** (`tests/unit/**`) mirrors `src/` file for file and touches nothing
 * outside the module under test. No database, no seed, no serialisation — so it
 * runs in parallel and finishes in about a second, which is what makes it usable
 * in a watch loop while the integration suite is what you run before pushing.
 *
 * Run one or the other with `vitest run --project unit`.
 */
const ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_test',
  // pg-boss off: the suite drives handlers directly where it needs them, and a
  // background poller against the test database is just noise.
  JOBS_ENABLED: 'false',
  WORKER_INLINE: 'false',
  // The limits are exercised by their own test, which enables them locally.
  RATE_LIMIT_ENABLED: 'false',
  LOG_LEVEL: 'silent',
  STORAGE_LOCAL_DIR: '.storage-test',
  // Local disk, not MinIO: the suite must not need a container running, and
  // the presign→PUT→commit contract it exercises is identical either way.
  STORAGE_DRIVER: 'local',
  // The S3 adapter's own unit test builds it directly and signs URLs offline;
  // SigV4 needs credentials to exist, not to be valid.
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  // Stated rather than inherited. `env.ts` already defaults this off under
  // test, but the developer's own `.env` sets it *on*, and dotenv fills in any
  // variable the runner has not — so without this line the suite's behaviour
  // would depend on a file that is not in the repository.
  DOCS_ENABLED: 'false',
};

/**
 * 90% or the run fails, measured across **both** projects at once.
 *
 * `all: true` is what makes the number mean anything: without it, coverage is
 * reported only for files some test happened to import, so deleting a test file
 * would *raise* the percentage. Here every file under `src/` counts whether or
 * not it is imported.
 *
 * Two files are excluded, and only these two:
 *   · `types/express.d.ts` — a declaration file. It emits no JavaScript, so
 *     there is nothing to execute or to count.
 *   · `index.ts` — the process entry point. It calls `listen()`, registers
 *     SIGTERM handlers and starts the pg-boss poller at import time; importing
 *     it under test would open a port and leave a queue running. Its whole
 *     content is `createApp(await buildContainer())` plus shutdown wiring, both
 *     covered through `server.ts` and `container.ts`.
 */
const COVERAGE_THRESHOLD = 90;

export default defineConfig({
  test: {
    /**
     * Transitional, for the reconstruction only. Between `chore: initialize
     * project` and the feature that brings this package's tests across, there
     * are legitimately no test files here and vitest would otherwise exit 1.
     * Remove this line once the suite is fully restored — see
     * `docs/project/feature-map.md`.
     */
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      /**
       * An explicit `include` is what makes a file with no test at all count
       * as 0% rather than being left out of the denominator — without it,
       * coverage measures only what someone remembered to import, and the
       * threshold means nothing. (Vitest 3's `all: true` did this; in Vitest 4
       * `include` subsumes it.)
       */
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/index.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          env: ENV,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          globalSetup: ['./tests/global-setup.ts'],
          include: ['tests/*.test.ts'],
          fileParallelism: false,
          pool: 'forks',
          // One worker, one connection pool, one sequence of credit movements.
          maxWorkers: 1,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          env: ENV,
        },
      },
    ],
  },
});
