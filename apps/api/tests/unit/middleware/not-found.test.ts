import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { notFound } from '../../../src/middleware/not-found.js';
import { NotFoundError } from '../../../src/platform/errors.js';

/**
 * Without this, an unmatched route falls through to Express's built-in
 * handler, which answers `text/html` — a client parsing `application/
 * problem+json` on every other failure would get a surprise on this one.
 */

function run(req: Partial<Request>): unknown {
  let passed: unknown = 'not-called';
  notFound(
    { method: 'GET', originalUrl: '/', ...req } as Request,
    {} as Response,
    ((error?: unknown) => {
      passed = error;
    }) as NextFunction,
  );
  return passed;
}

describe('notFound', () => {
  it('forwards a NotFoundError so the problem handler renders it', () => {
    const error = run({ method: 'GET', originalUrl: '/v1/nope' });

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).status).toBe(404);
  });

  it('names the method and the path that missed', () => {
    expect((run({ method: 'POST', originalUrl: '/v1/typo' }) as NotFoundError).detail).toBe(
      'No route matches POST /v1/typo.',
    );
  });

  it('uses originalUrl, so a path inside a mounted router is reported in full', () => {
    expect(
      (run({ method: 'GET', originalUrl: '/v1/dealer/vehicles/typo' }) as NotFoundError).detail,
    ).toContain('/v1/dealer/vehicles/typo');
  });

  it('includes the query string a caller actually sent', () => {
    expect(
      (run({ method: 'GET', originalUrl: '/v1/vehicles?lmit=5' }) as NotFoundError).detail,
    ).toContain('lmit=5');
  });

  it.each(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])('handles %s', (method) => {
    expect((run({ method, originalUrl: '/x' }) as NotFoundError).detail).toContain(method);
  });

  it('never responds itself — the error handler owns the response', () => {
    let touched = false;
    const res = new Proxy({} as Response, {
      get() {
        touched = true;
        return () => undefined;
      },
    });

    notFound(
      { method: 'GET', originalUrl: '/x' } as Request,
      res,
      (() => undefined) as NextFunction,
    );

    expect(touched).toBe(false);
  });
});
