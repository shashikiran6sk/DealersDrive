import type { ProblemDetails } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, UpstreamUnavailableError } from './api';
import { categoryOf, safeMessage } from './errors';
import { logger } from './logger';

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' } as const;

function publicProblem(problem: ProblemDetails): ProblemDetails {
  return {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    code: problem.code,
    ...(problem.detail === undefined ? {} : { detail: problem.detail }),
    ...(problem.errors === undefined ? {} : { errors: problem.errors }),
    ...(problem.traceId === undefined ? {} : { traceId: problem.traceId }),
  };
}

function gatewayStatus(error: unknown): number {
  if (error instanceof UpstreamUnavailableError) return error.kind === 'timeout' ? 504 : 502;
  if (error instanceof ApiError && error.status >= 500)
    return error.status === 500 ? 502 : error.status;
  return 500;
}

export function problemResponse(error: unknown, route: string): NextResponse {
  if (error instanceof ApiError && error.status < 500) {
    return NextResponse.json(publicProblem(error.problem), {
      status: error.status,
      headers: PROBLEM_HEADERS,
    });
  }

  if (!(error instanceof ApiError) && !(error instanceof UpstreamUnavailableError)) {
    logger.error('bff.unexpected_failure', { route, error });
  }

  const status = gatewayStatus(error);
  const category = categoryOf(error);
  const traceId = error instanceof ApiError ? error.traceId : undefined;
  const problem: ProblemDetails = {
    type: 'about:blank',
    title: category === 'SERVICE_UNAVAILABLE' ? 'Service unavailable' : 'Internal error',
    status,
    code: category === 'SERVICE_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
    detail: safeMessage(error),
    ...(traceId === undefined ? {} : { traceId }),
  };
  return NextResponse.json(problem, { status, headers: PROBLEM_HEADERS });
}
