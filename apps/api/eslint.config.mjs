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
     *
     * Two more are off for the unit suite specifically, and for the same
     * reason — they are false positives by construction rather than findings:
     *
     *   `require-await`  — a test double standing in for an async port has to
     *     return a promise and has nothing to await. `async () => rows` is the
     *     clearest way to write that; rewriting each one as
     *     `() => Promise.resolve(rows)` obscures what is being stubbed and
     *     changes nothing about the code under test.
     *
     *   `unbound-method`  — `expect(prisma.findMany).toHaveBeenCalledWith(…)`
     *     is how a vitest mock is asserted on. The rule is warning about a
     *     `this` binding that a mock does not have and never uses.
     *
     * Both stay on for `src/`, where they do catch real mistakes.
     */
    files: ['tests/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'no-console': 'off',
    },
  },
];
