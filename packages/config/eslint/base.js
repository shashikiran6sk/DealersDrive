import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

import dealersDrive from './rules/no-comments.js';

/**
 * Shared flat-config base. Type-aware linting is on, so every linted file must
 * be covered by the app's tsconfig.json.
 *
 * @param {{ tsconfigRootDir: string }} options
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function baseConfig({ tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/next-env.d.ts',
      ],
    },
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: { 'dealers-drive': dealersDrive },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        /*
         * `any` switches type checking off for everything it touches, and it
         * spreads: one `any` argument makes the whole call expression `any`.
         * `unknown` plus a narrowing check is the answer wherever a value really
         * is unknown, and the codebase has no `any` left to grandfather in.
         */
        '@typescript-eslint/no-explicit-any': 'error',
        /*
         * A type assertion tells the compiler to stop asking. Where a value
         * genuinely arrives untyped — a JSON body, an environment variable — the
         * answer is a parse or a type guard, both of which can be wrong at
         * runtime in a way that surfaces. The two remaining boundaries carry a
         * scoped disable naming why.
         */
        '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        'no-console': ['error', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always', { null: 'ignore' }],
      },
    },
    /*
     * Tests construct partial fixtures and stub globals, which is the one place
     * an assertion is the right tool: the value is being *made* to stand in for
     * a contract type rather than arriving from outside and being trusted. The
     * `any` ban still applies here.
     */
    {
      files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}'],
      rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
    },
    // Config files are linted without type information.
    {
      files: ['**/*.{js,mjs,cjs}', '**/*.config.{ts,mts}'],
      extends: [tseslint.configs.disableTypeChecked],
      rules: { 'no-console': 'off' },
    },
    prettier,
  );
}

export default baseConfig;
