import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

/**
 * One `.env`, at the repo root, for both apps.
 *
 * Next only looks inside its own project directory, so without this the web app
 * would need a second copy of `API_BASE_URL` — and two files that must agree is
 * how they stop agreeing. dotenv never overwrites a variable that is already
 * set, so a real environment variable still wins over the file.
 */
loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /** Workspace packages ship TypeScript-adjacent ESM; let Next compile them. */
  transpilePackages: ['@dealers-drive/contracts'],

  /** A type error must fail the build, in CI and locally. */
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true }, // lint runs as its own turbo task
};

export default nextConfig;
