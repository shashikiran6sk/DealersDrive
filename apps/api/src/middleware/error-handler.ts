import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import {
  AppError,
  problemTypeFromCode,
  RateLimitError,
  type FieldError,
  titleFromCode,
} from '../platform/errors.js';
import { logger } from '../platform/telemetry/logger.js';
import { normalizedHttpRoute } from '../platform/telemetry/http-route.js';
import { getTraceId } from './request-context.js';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  traceId: string;
  detail?: string;
  errors?: FieldError[];
  [key: string]: unknown;
}

function fieldErrorsFromZod(error: ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    const base = issue.path.map((segment) => String(segment));

    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: [...base, key].join('.') || key,
        code: 'UNRECOGNIZED_KEY',
        message: `\`${key}\` is not a recognised field.`,
      }));
    }

    return [
      {
        field: base.join('.') || '(root)',
        code: issue.code.toUpperCase(),
        message: issue.message,
      },
    ];
  });
}

interface BodyParserError extends Error {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    'type' in error &&
    typeof (error as { type: unknown }).type === 'string' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

const BODY_PARSER_CODES: Record<string, { status: number; code: string; detail: string }> = {
  'entity.parse.failed': {
    status: 400,
    code: 'MALFORMED_BODY',
    detail: 'The request body is not valid JSON.',
  },
  'entity.too.large': {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    detail: 'The request body exceeds the maximum accepted size.',
  },
  'encoding.unsupported': {
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    detail: 'The request body uses an unsupported content encoding.',
  },
};

function build(
  status: number,
  code: string,
  traceId: string,
  detail?: string,
  errors?: FieldError[],
  title?: string,
): ProblemDetails {
  return {
    type: problemTypeFromCode(code),
    title: title ?? titleFromCode(code),
    status,
    code,
    traceId,
    ...(detail === undefined ? {} : { detail }),
    ...(errors && errors.length > 0 ? { errors } : {}),
  };
}

function toProblem(error: unknown, traceId: string): ProblemDetails {
  if (error instanceof ZodError) {
    return build(
      400,
      'VALIDATION_FAILED',
      traceId,
      'The request did not match the expected shape.',
      fieldErrorsFromZod(error),
      'Validation failed',
    );
  }

  if (error instanceof AppError) {
    return {
      ...build(error.status, error.code, traceId, error.detail, error.errors, error.title),
      ...(error.extra ?? {}),
    };
  }

  if (isBodyParserError(error)) {
    const mapped = BODY_PARSER_CODES[error.type];
    if (mapped) {
      return build(mapped.status, mapped.code, traceId, mapped.detail);
    }
    return build(400, 'MALFORMED_BODY', traceId, 'The request body could not be read.');
  }

  return build(
    500,
    'INTERNAL',
    traceId,
    env.isProduction
      ? undefined
      : error instanceof Error
        ? error.message
        : `Non-error thrown: ${String(error)}`,
    undefined,
    'Internal server error',
  );
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const traceId = getTraceId() ?? nanoid(10);
  const problem = toProblem(error, traceId);

  const logBindings = {
    traceId,
    status: problem.status,
    code: problem.code,
    method: req.method,
    route: normalizedHttpRoute(req),
    status_code: problem.status,
  };

  if (problem.status >= 500) {
    logger.error({ ...logBindings, err: error }, 'request failed');
  } else {
    logger.warn(logBindings, 'request rejected');
  }

  if (error instanceof RateLimitError) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
  }

  res.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
}
