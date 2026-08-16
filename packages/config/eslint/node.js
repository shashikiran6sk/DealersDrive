import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.js';

/**
 * Rule 3 (MVP-SCOPE §4.4): cross-module imports go through *.facade.ts only.
 * Matches `../<other-module>/<anything>` while allowing `../<module>/*.facade`
 * and anything further up the tree (`../../platform/**`, `../../config/**`).
 */
const facadeOnlyPattern = {
  regex: '^\\.\\./(?!\\.\\./)[^/]+/(?!.*\\.facade(\\.js)?$).+$',
  message:
    'Cross-module imports go through <module>.facade.ts, never its internals (MVP-SCOPE §4.4 rule 3).',
};

/**
 * Rule 1 (MVP-SCOPE §4.4): services and facades never see req/res.
 * ESLint replaces rule options rather than merging them, so every block that
 * sets `no-restricted-imports` has to restate the patterns it still wants.
 */
const noExpressPath = {
  name: 'express',
  message: 'Services never see req/res. Keep express in *.routes.ts (MVP-SCOPE §4.4 rule 1).',
};

/**
 * Preset for apps/api — the rules that keep Express from turning into a mud
 * ball are enforced by the linter, not by code review.
 *
 * @param {{ tsconfigRootDir: string }} options
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function nodeConfig({ tsconfigRootDir }) {
  return tseslint.config(
    baseConfig({ tsconfigRootDir }),
    {
      languageOptions: {
        globals: globals.node,
      },
    },
    {
      files: ['src/modules/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [facadeOnlyPattern] }],
      },
    },
    {
      files: ['src/modules/**/*.service.ts', 'src/modules/**/*.facade.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [facadeOnlyPattern], paths: [noExpressPath] },
        ],
      },
    },
    // Rule 2 — only *.repository.ts imports prisma — turns on with Day 3's
    // platform/db/prisma.ts, by adding a `paths` entry for it to every block
    // above except `**/*.repository.ts`.
  );
}

export default nodeConfig;
