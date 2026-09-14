import { NextResponse } from 'next/server';

import { serverConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const { appEnv } = serverConfig();

  return NextResponse.json({
    status: 'ok',
    appEnv,
    version: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  });
}
