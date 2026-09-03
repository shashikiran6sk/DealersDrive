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
 * `version` is the commit this image was built from, and it is how a deploy
 * tells "the new tasks are serving" from "the old ones still are" — both
 * answer 200 (ARCHITECTURE §20.3).
 */
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const { appEnv } = serverConfig();

  return NextResponse.json({
    status: 'ok',
    appEnv,
    version: process.env.GIT_SHA ?? 'unknown',
  });
}
