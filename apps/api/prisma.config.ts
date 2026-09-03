import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * One `.env`, at the repo root, for the Prisma CLI too.
 *
 * The CLI only looks in its own working directory, so without this `pnpm
 * db:migrate` would need a second copy of `DATABASE_URL` inside `apps/api` —
 * and a second copy is how the two stop agreeing. This also replaces the
 * deprecated `package.json#prisma` block.
 */
loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed/index.ts',
  },
});
