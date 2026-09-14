import type { Request, RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';

type ZodIssue = ZodError['issues'][number];

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

function withSource(issues: ZodIssue[], source: ValidationSource): ZodIssue[] {
  return issues.map((issue) => ({ ...issue, path: [source, ...issue.path] }));
}

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

export function validated<T>(req: Request, source: ValidationSource): T {
  const value = req.valid?.[source];
  if (value === undefined) {
    throw new Error(
      `No validated "${source}" on this request. Add validate({ ${source}: Schema }) to the route.`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the parse boundary: this is where an unknown body becomes T
  return value as T;
}
