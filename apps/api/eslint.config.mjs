import { nodeConfig } from '@dealers-drive/config/eslint/node';

export default [
  ...nodeConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    /**
     * Tests and the seed.
     *
     * supertest types `response.body` as `any` — it cannot know the shape of a
     * response it did not declare — so every assertion against a body trips the
     * `no-unsafe-*` family. Silencing them here is not a licence to write `any`:
     * `no-explicit-any` stays on, and the assertion *is* the type check. The
     * alternative, casting every `.body` read, would bury what each test is
     * actually claiming.
     *
     * The seed is a script, not the server, so the module-boundary rules that
     * keep the modules apart do not apply to it.
     */
    files: ['tests/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-console': 'off',
    },
  },
];
