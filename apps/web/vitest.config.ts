import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The web app had no test setup at all before this. Three decisions are worth
 * recording, because each one is the reason a whole class of test is possible.
 *
 * **jsdom, not happy-dom.** The gallery and the filter panel use focus
 * management, keyboard handling and `scrollIntoView`; jsdom implements enough
 * of those to assert on them without stubbing the behaviour under test.
 *
 * **Next's server-only boundary is stubbed rather than avoided.**
 * `next/headers`, `next/navigation` and `server-only` all throw outside a
 * request. Aliasing them to fakes in `tests/setup.ts` is what lets a server
 * component and a server action be called directly, which is where most of
 * this app's logic actually lives.
 *
 * **90%, enforced.** The same gate as the api and the contracts package —
 * `pnpm test` fails below it rather than reporting and passing.
 */
const COVERAGE_THRESHOLD = 90;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /**
       * `server-only` is a build-time guard: importing it from a client bundle
       * is meant to fail the build. Under test there is no bundler to make
       * that distinction, so it resolves to an empty module.
       */
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000',
      API_BASE_URL: 'http://localhost:4000',
      NEXT_PUBLIC_WEB_BASE_URL: 'http://localhost:3000',
    },
    coverage: {
      provider: 'v8',
      /**
       * Explicit, so a component nobody wrote a test for counts as 0% rather
       * than dropping out of the denominator entirely.
       */
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Type declarations and generated Next types emit no JavaScript.
        'src/**/*.d.ts',
        // Tailwind/global styling entrypoints carry no logic.
        'src/app/globals.css',
      ],
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
