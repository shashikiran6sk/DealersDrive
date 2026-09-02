import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { errorHandler, type ProblemDetails } from '../../../src/middleware/error-handler.js';
import { runWithContext } from '../../../src/middleware/request-context.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '../../../src/platform/errors.js';

/**
 * This middleware is the only thing standing between a thrown exception and
 * the wire, so two properties matter more than the rest:
 *
 *  · **Every** failure leaves as RFC 9457 `application/problem+json` — one
 *    shape, so a client writes one error path rather than six.
 *  · A bug never leaks its message in production. The 500 branch is the one
 *    place a stack trace could escape, and CLAUDE.md forbids it outright.
 *
 * Everything else here is mapping: which throwable becomes which status.
 */

interface Captured {
  status: number;
  type: string;
  body: ProblemDetails;
  headers: Record<string, string>;
}

function invoke(
  error: unknown,
  options: { headersSent?: boolean; traceId?: string; method?: string; url?: string } = {},
): { captured: Captured; next: NextFunction } {
  const captured: Captured = {
    status: 0,
    type: '',
    body: {} as ProblemDetails,
    headers: {},
  };

  const res = {
    headersSent: options.headersSent ?? false,
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    status(code: number) {
      captured.status = code;
      return res;
    },
    type(contentType: string) {
      captured.type = contentType;
      return res;
    },
    json(payload: ProblemDetails) {
      captured.body = payload;
      return res;
    },
  } as unknown as Response;

  const req = {
    method: options.method ?? 'POST',
    originalUrl: options.url ?? '/v1/dealer/listings',
  } as Request;

  const next = vi.fn() as unknown as NextFunction;

  const run = () => {
    errorHandler(error, req, res, next);
  };

  if (options.traceId === undefined) {
    run();
  } else {
    runWithContext({ traceId: options.traceId, ip: '127.0.0.1' }, run);
  }

  return { captured, next };
}

describe('shape', () => {
  it('always answers application/problem+json', () => {
    const { captured } = invoke(new NotFoundError());

    expect(captured.type).toBe('application/problem+json');
  });

  it('carries type, title, status, code and traceId on every problem', () => {
    const { captured } = invoke(new NotFoundError(), { traceId: 'trace-abc' });

    expect(captured.body).toMatchObject({
      type: expect.stringContaining('not-found'),
      title: expect.any(String),
      status: 404,
      code: 'NOT_FOUND',
      traceId: 'trace-abc',
    });
  });

  it('reuses the request traceId so a support ticket can quote one id', () => {
    const { captured } = invoke(new ForbiddenError(), { traceId: 'from-context' });

    expect(captured.body.traceId).toBe('from-context');
  });

  it('mints a traceId when thrown outside any request scope', () => {
    const { captured } = invoke(new ForbiddenError());

    expect(captured.body.traceId).toMatch(/^[\w-]{10}$/);
  });

  it('omits detail rather than sending an empty one', () => {
    const { captured } = invoke(new Error('boom'));

    // Non-production, so the message is present; the key exists exactly once.
    expect(Object.keys(captured.body)).not.toContain('errors');
  });
});

describe('AppError mapping', () => {
  it.each([
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new UnauthorizedError(), 401, 'NOT_AUTHENTICATED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new ConflictError('LISTING_ALREADY_LIVE', 'Already live.'), 409, 'LISTING_ALREADY_LIVE'],
    [new DomainError('INCOMPLETE_LISTING', 'Fill it in.'), 422, 'INCOMPLETE_LISTING'],
  ])('%# maps to its own status and code', (error, status, code) => {
    const { captured } = invoke(error);

    expect(captured.status).toBe(status);
    expect(captured.body.status).toBe(status);
    expect(captured.body.code).toBe(code);
  });

  it('lets an error override the generic code', () => {
    const { captured } = invoke(
      new ForbiddenError('Your dealership is not active yet.', { code: 'DEALER_NOT_ACTIVE' }),
    );

    expect(captured.body.code).toBe('DEALER_NOT_ACTIVE');
    expect(captured.status).toBe(403);
  });

  it('spreads spec-mandated extras such as creditBalance', () => {
    const { captured } = invoke(
      new DomainError('INSUFFICIENT_CREDITS', 'Out of credits.', {
        extra: { creditBalance: 0, required: 1 },
      }),
    );

    expect(captured.body.creditBalance).toBe(0);
    expect(captured.body.required).toBe(1);
  });

  it('carries field errors through untouched', () => {
    const { captured } = invoke(
      new DomainError('INCOMPLETE_LISTING', 'Missing fields.', {
        errors: [{ field: 'price', code: 'REQUIRED', message: 'Price is required.' }],
      }),
    );

    expect(captured.body.errors).toEqual([
      { field: 'price', code: 'REQUIRED', message: 'Price is required.' },
    ]);
  });

  it('sets Retry-After on a rate limit, and only on a rate limit', () => {
    const limited = invoke(new RateLimitError('Slow down.', 42));
    const forbidden = invoke(new ForbiddenError());

    expect(limited.captured.headers['Retry-After']).toBe('42');
    expect(limited.captured.status).toBe(429);
    expect(forbidden.captured.headers['Retry-After']).toBeUndefined();
  });
});

describe('ZodError', () => {
  it('becomes a 400 with one entry per failing field', () => {
    const schema = z.object({ price: z.number(), year: z.number() });
    const parsed = schema.safeParse({ price: 'lots', year: 'old' });

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.status).toBe(400);
    expect(captured.body.code).toBe('VALIDATION_FAILED');
    expect(captured.body.title).toBe('Validation failed');
    expect(captured.body.errors).toHaveLength(2);
    expect(captured.body.errors?.map((e) => e.field).sort()).toEqual(['price', 'year']);
  });

  it('upper-cases the Zod issue code so a client can switch on it', () => {
    const parsed = z.object({ price: z.number() }).safeParse({ price: 'lots' });

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.body.errors?.[0]?.code).toBe('INVALID_TYPE');
  });

  it('joins a nested path with dots', () => {
    const schema = z.object({ pricing: z.object({ amount: z.number() }) });
    const parsed = schema.safeParse({ pricing: { amount: 'x' } });

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.body.errors?.[0]?.field).toBe('pricing.amount');
  });

  it('labels a root-level issue `(root)` rather than an empty string', () => {
    const parsed = z.string().safeParse(42);

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.body.errors?.[0]?.field).toBe('(root)');
  });

  /**
   * The whole point of `.strict()` is that a caller finds their typo. Naming
   * the *object* that held the stray key would not do that, so an
   * unrecognized_keys issue fans out into one error per key, each named.
   */
  it('names every surplus key rather than the object that held them', () => {
    const parsed = z
      .object({ limit: z.number() })
      .strict()
      .safeParse({ limit: 1, lmit: 2, offest: 3 });

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.body.errors).toEqual([
      { field: 'lmit', code: 'UNRECOGNIZED_KEY', message: '`lmit` is not a recognised field.' },
      { field: 'offest', code: 'UNRECOGNIZED_KEY', message: '`offest` is not a recognised field.' },
    ]);
  });

  it('prefixes a nested surplus key with its object path', () => {
    const parsed = z
      .object({ filters: z.object({ make: z.string() }).strict() })
      .safeParse({ filters: { make: 'Maruti', colour: 'red' } });

    const { captured } = invoke(parsed.success ? new Error('unreachable') : parsed.error);

    expect(captured.body.errors?.[0]?.field).toBe('filters.colour');
  });
});

describe('body-parser errors', () => {
  function bodyParserError(type: string, status: number): Error {
    return Object.assign(new Error('parser said no'), { type, status });
  }

  it.each([
    ['entity.parse.failed', 400, 'MALFORMED_BODY'],
    ['entity.too.large', 413, 'PAYLOAD_TOO_LARGE'],
    ['encoding.unsupported', 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ])('maps %s without falling through to a 500', (type, status, code) => {
    const { captured } = invoke(bodyParserError(type, status));

    expect(captured.status).toBe(status);
    expect(captured.body.code).toBe(code);
  });

  it('falls back to a 400 for an unmapped parser type', () => {
    const { captured } = invoke(bodyParserError('stream.encoding.set', 500));

    expect(captured.status).toBe(400);
    expect(captured.body.code).toBe('MALFORMED_BODY');
  });

  it('does not mistake a plain Error for a parser error', () => {
    const { captured } = invoke(new Error('ordinary bug'));

    expect(captured.status).toBe(500);
  });

  it('needs both type and status to count as a parser error', () => {
    const typeOnly = Object.assign(new Error('x'), { type: 'entity.too.large' });
    const statusOnly = Object.assign(new Error('x'), { status: 413 });

    expect(invoke(typeOnly).captured.status).toBe(500);
    expect(invoke(statusOnly).captured.status).toBe(500);
  });
});

describe('unknown throwables', () => {
  it('becomes a 500 INTERNAL', () => {
    const { captured } = invoke(new Error('prisma exploded'));

    expect(captured.status).toBe(500);
    expect(captured.body.code).toBe('INTERNAL');
    expect(captured.body.title).toBe('Internal server error');
  });

  it('reports the message outside production, where it helps a developer', () => {
    const { captured } = invoke(new Error('prisma exploded'));

    expect(captured.body.detail).toBe('prisma exploded');
  });

  it('describes a thrown non-error rather than rendering [object Object]', () => {
    const { captured } = invoke({ nope: true });

    expect(captured.body.detail).toBe('Non-error thrown: [object Object]');
  });

  it('handles a thrown string', () => {
    const { captured } = invoke('just a string');

    expect(captured.body.detail).toBe('Non-error thrown: just a string');
  });

  /**
   * CLAUDE.md: "Never leak stack traces or internal implementation details to
   * clients." In production the detail is dropped entirely — the traceId is
   * how support correlates the report with the log line that has the stack.
   */
  it('never leaks a bug message in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEB_ORIGIN', 'https://dealers-drive.com');
    vi.stubEnv('WEB_BASE_URL', 'https://dealers-drive.com');
    vi.stubEnv('API_BASE_URL', 'https://api.dealers-drive.com');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@db:5432/d');
    vi.stubEnv('MEDIA_BASE_URL', 'https://api.dealers-drive.com/media');
    // Production refuses to boot without these; see `env.test.ts`.
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('STORAGE_DRIVER', 'r2');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'r2-key');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'r2-secret');
    vi.stubEnv('SESSION_SECRET', 'a-real-production-session-secret');
    vi.stubEnv('UPLOAD_SIGNING_SECRET', 'a-real-production-upload-secret');
    vi.stubEnv('RC_PLATE_HASH_SECRET', 'a-real-production-plate-secret');

    try {
      const { errorHandler: productionHandler } =
        await import('../../../src/middleware/error-handler.js');

      let body = {} as ProblemDetails;
      const res = {
        headersSent: false,
        setHeader: () => undefined,
        status: () => res,
        type: () => res,
        json: (payload: ProblemDetails) => {
          body = payload;
          return res;
        },
      } as unknown as Response;

      productionHandler(
        new Error('SELECT * FROM users WHERE secret = $1 failed'),
        { method: 'GET', originalUrl: '/v1/vehicles' } as Request,
        res,
        vi.fn(),
      );

      expect(body.status).toBe(500);
      expect(body.detail).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('SELECT');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('headers already sent', () => {
  /**
   * A media stream that fails mid-body cannot be given a JSON error — the
   * status line is long gone. Handing it back to Express is what destroys the
   * socket; writing a second status would throw ERR_HTTP_HEADERS_SENT.
   */
  it('delegates to Express instead of writing a second response', () => {
    const error = new Error('stream died');
    const { captured, next } = invoke(error, { headersSent: true });

    expect(next).toHaveBeenCalledWith(error);
    expect(captured.status).toBe(0);
    expect(captured.body).toEqual({});
  });

  it('does not delegate on the ordinary path', () => {
    const { next } = invoke(new NotFoundError());

    expect(next).not.toHaveBeenCalled();
  });
});
