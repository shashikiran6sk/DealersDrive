import { defineConfig } from 'vitest/config';

/**
 * The contracts package is pure: Zod schemas and the formatters both apps
 * share. There is nothing to mock and nothing to seed, so there is one project
 * rather than the api's unit/integration split.
 *
 * The 90% gate is enforced here as well as in the api. This package is the one
 * place a rounding rule or a query grammar is written down — `formatLakh` is
 * called from both apps and from the seed — so an untested branch here is an
 * untested branch in three places at once.
 */
const COVERAGE_THRESHOLD = 90;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
       * Explicit, so a schema file nobody imported still counts as 0% rather
       * than dropping out of the denominator.
       */
      include: ['src/**/*.ts'],
      /**
       * `index.ts` is a barrel of `export *` lines — it emits re-exports and
       * no logic, so there is no behaviour to cover and its presence would
       * only inflate the numbers.
       */
      exclude: ['src/index.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
      },
    },
  },
});
