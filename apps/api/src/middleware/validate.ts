import type { Request, RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';

type ZodIssue = ZodError['issues'][number];

/** Where a validated value came from. Also the key it is stored under. */
export type ValidationSource = 'body' | 'query' | 'params';

export interface ValidatedData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export interface ValidationSchemas<Body, Query, Params> {
  body?: ZodType<Body>;
  query?: ZodType<Query>;
  params?: ZodType<Params>;
}

/** Prefix each issue path with its source, so `errors[].field` reads `body.price`. */
function withSource(issues: ZodIssue[], source: ValidationSource): ZodIssue[] {
  return issues.map((issue) => ({ ...issue, path: [source, ...issue.path] }));
}

/**
 * Parses the parts of a request a route declares, and nothing else.
 *
 *   r.post('/dealer/vehicles',
 *     validate({ body: CreateVehicleInput }),
 *     c.create);
 *
 * On failure it forwards a single ZodError carrying every issue from every
 * source, which the error handler renders as one 400 VALIDATION_FAILED with a
 * populated `errors[]` — the caller sees all their mistakes at once.
 *
 * Express 5 makes `req.query` a getter, so parsed values are written to
 * `req.valid` rather than back onto the request. Read them with
 * `validated<T>(req, 'query')`; unparsed `req.query` is never the source of
 * truth in a handler.
 *
 * Day 5 extends this with `.strict()` contracts so unknown query params 400
 * instead of being silently ignored (ARCHITECTURE §10.3).
 */
export function validate<Body = unknown, Query = unknown, Params = unknown>(
  schemas: ValidationSchemas<Body, Query, Params>,
): RequestHandler {
  return (req, _res, next) => {
    const issues: ZodIssue[] = [];
    const valid: ValidatedData = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        valid.body = result.data;
        req.body = result.data;
      } else {
        issues.push(...withSource(result.error.issues, 'body'));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        valid.query = result.data;
      } else {
        issues.push(...withSource(result.error.issues, 'query'));
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        valid.params = result.data;
      } else {
        issues.push(...withSource(result.error.issues, 'params'));
      }
    }

    if (issues.length > 0) {
      next(new ZodError(issues));
      return;
    }

    req.valid = { ...req.valid, ...valid };
    next();
  };
}

/**
 * Typed read of a value `validate()` already parsed. Throws if the route
 * forgot to declare the schema — a programmer error, not a client error.
 */
export function validated<T>(req: Request, source: ValidationSource): T {
  const value = req.valid?.[source];
  if (value === undefined) {
    throw new Error(
      `No validated "${source}" on this request. Add validate({ ${source}: Schema }) to the route.`,
    );
  }
  return value as T;
}
