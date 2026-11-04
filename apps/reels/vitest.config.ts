import { defineConfig } from 'vitest/config';

const COVERAGE_THRESHOLD = 90;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/data/**/*.ts',
        'src/copy/**/*.ts',
        'src/lib/**/*.ts',
        'src/audio/**/*.ts',
        'src/cli/args.ts',
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
