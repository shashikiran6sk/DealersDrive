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

  /**
   * The OAuth round trip, proxied — the one thing D7 breaks, and its fix.
   *
   * The API sets `dd_session` on its own host and then 302s to WEB_BASE_URL
   * (`apps/api/src/modules/auth/auth.routes.ts`). That worked while the ALB
   * served both tiers on one origin. Split across Vercel and AWS it does not:
   * the cookie is host-only *by design* — `SESSION_COOKIE_DOMAIN` is empty in
   * every environment so that a dev session can never be presented to
   * production — so it would land on the API host and `cookies()` on the
   * Vercel host would never see it.
   *
   * Rewriting the two OAuth navigations makes the browser see one origin
   * again. The API's `Set-Cookie` carries no `Domain`, so the browser assigns
   * it to the host it asked: this one. Nothing in the API changes, the
   * host-only cookie survives, no CORS is needed, and no `NEXT_PUBLIC_*` is
   * introduced. `GOOGLE_CALLBACK_URL` becomes this origin's
   * `/v1/auth/google/callback` and is registered as such with Google.
   *
   * Only these two paths. Everything else the browser needs already goes
   * through a Server Action or an `/api/*` BFF handler, and media bytes go
   * direct to the API host — proxying those would put every photo through
   * Vercel's bandwidth for no benefit.
   *
   * This is the one environment-specific value baked into the web build, and
   * it is a deliberate exception rather than a hole in Rule 9: D7 already
   * moved the web tier to one build per environment, so the artifact is no
   * longer promoted between them. Unset, the rewrite does not exist — which
   * is the correct behaviour for a local `pnpm dev`, where the API is reached
   * on its own port anyway.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) return [];

    return [
      {
        source: '/v1/auth/google/:path*',
        destination: `${apiOrigin}/v1/auth/google/:path*`,
      },
    ];
  },
};

export default nextConfig;
