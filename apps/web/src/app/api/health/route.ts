import { NextResponse } from 'next/server';

import { serverConfig } from '@/lib/config';

/**
 * The web app's own liveness probe — what the load balancer polls.
 *
 * It deliberately does **not** call the API. A target group that fails when
 * its upstream is unhealthy takes the whole front end out of rotation over a
 * problem the front end cannot fix, and then there is nothing left to serve
 * the error page. The API has its own target group and its own `/health/ready`
 * for that question.
 *
 * `version` is the commit this build was made from, and it is how a deploy
 * tells "the new build is serving" from "the old one still is" — both answer
 * 200 (ARCHITECTURE §20.3). `scripts/smoke.sh` and the promotion preflight
 * both read it.
 *
 * Two sources because there are two platforms since D7, and neither can be
 * assumed: `GIT_SHA` is what the Dockerfile sets in its runner stage and what
 * the deploy workflow passes to `vercel deploy --env`; `VERCEL_GIT_COMMIT_SHA`
 * is Vercel's own, present when it has git metadata for the deployment. It is
 * read at request time rather than inlined at build time — the value names the
 * artifact, so baking it in would be legitimate, but `next.config.ts` has no
 * `env` block and adding one would break the Docker path, which sets GIT_SHA
 * on the *runtime* image rather than during `next build`.
 */
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const { appEnv } = serverConfig();

  return NextResponse.json({
    status: 'ok',
    appEnv,
    version: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  });
}
