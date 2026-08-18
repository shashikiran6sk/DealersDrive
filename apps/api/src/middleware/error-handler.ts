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
import { getTraceId } from './request-context.js';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * RFC 9457 Problem Details — the one and only error shape this API emits.
 *
 * {
 *   "type": "https://dealersdrive.com/errors/not-found",
 *   "title": "Not found",
 *   "status": 404,
 *   "code": "NOT_FOUND",
 *   "traceId": "a1b2c3d4",
 *   "detail": "The requested resource does not exist."
 * }
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  traceId: string;
  detail?: string;
  errors?: FieldError[];
  /** Spec-mandated extras such as `creditBalance` on INSUFFICIENT_CREDITS. */
  [key: string]: unknown;
}

/** Zod's `invalid_type` becomes `INVALID_TYPE` — machine-readable per field. */
function fieldErrorsFromZod(error: ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    const base = issue.path.map((segment) => String(segment));

    /**
     * An unrecognized key carries its own name in `keys`, not in `path` — the
     * path points at the *object* that had the surplus field. Naming the object
     * would defeat the point of `.strict()`: the reason an unknown parameter is
     * a 400 rather than a silent ignore is so the caller can find their typo
     * (ARCHITECTURE §9.2). One error per stray key, each naming the key.
     */
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

/**
 * Errors thrown by express.json()/urlencoded() before any route runs. They are
 * client mistakes, not bugs, so they must not fall through to a 500.
 */
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
  // ZodError -> 400 VALIDATION_FAILED, with per-field errors.
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

  // NotFoundError -> 404, ForbiddenError -> 403, UnauthorizedError -> 401,
  // DomainError -> 422 with its own code. Each error carries its own mapping.
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

  // Anything else is a bug. Never leak its message in production.
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

/**
 * The last middleware in the chain. Express 5 forwards rejected promises here
 * automatically, so `async` handlers need no try/catch wrapper.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Streaming already started — the only correct move is to destroy the socket.
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
    url: req.originalUrl,
  };

  if (problem.status >= 500) {
    // TODO(Day 2): Sentry.captureException(error, { tags: { traceId } });
    logger.error({ ...logBindings, err: error }, 'request failed');
  } else {
    logger.warn(logBindings, 'request rejected');
  }

  if (error instanceof RateLimitError) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
  }

  res.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
}
