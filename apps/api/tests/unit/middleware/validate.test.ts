import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';

import { validate, validated } from '../../../src/middleware/validate.js';

/**
 * Two properties carry the weight here.
 *
 * **Every mistake at once.** A route that declares body, query and params
 * collects the issues from all three and forwards one ZodError, so the caller
 * fixes their request in one round trip rather than three.
 *
 * **`req.valid`, not `req.query`.** Express 5 makes `req.query` a getter, so a
 * parsed value cannot be written back onto it. Anything that reads `req.query`
 * in a handler is reading the *unparsed* value — which is why `validated()`
 * throws instead of returning undefined when a schema was never declared.
 */

function run(
  handler: ReturnType<typeof validate>,
  req: Partial<Request> = {},
): { req: Request; error: unknown } {
  const request = { body: {}, query: {}, params: {}, ...req } as Request;
  let error: unknown = 'not-called';

  handler(
    request,
    {} as Response,
    ((passed?: unknown) => {
      error = passed;
    }) as NextFunction,
  );

  return { req: request, error };
}

const Body = z.object({ price: z.number(), km: z.number() });
const Query = z.object({ limit: z.coerce.number() });
const Params = z.object({ id: z.uuid() });

describe('parsing', () => {
  it('calls next() with nothing when everything parses', () => {
    const { error } = run(validate({ body: Body }), { body: { price: 1, km: 2 } });

    expect(error).toBeUndefined();
  });

  it('stores the parsed body under req.valid', () => {
    const { req } = run(validate({ body: Body }), { body: { price: 1, km: 2 } });

    expect(req.valid?.body).toEqual({ price: 1, km: 2 });
  });

  /** The body is not a getter, so it is safe — and useful — to normalise in place. */
  it('also writes the parsed body back onto req.body', () => {
    const { req } = run(validate({ body: Body }), { body: { price: 1, km: 2 } });

    expect(req.body).toEqual({ price: 1, km: 2 });
  });

  it('keeps the coerced query value, not the raw string', () => {
    const { req } = run(validate({ query: Query }), { query: { limit: '24' } });

    expect(req.valid?.query).toEqual({ limit: 24 });
  });

  /** Express 5 makes req.query a getter — writing back would throw. */
  it('does not write the parsed query back onto req.query', () => {
    const { req } = run(validate({ query: Query }), { query: { limit: '24' } });

    expect(req.query).toEqual({ limit: '24' });
  });

  it('parses params', () => {
    const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const { req } = run(validate({ params: Params }), { params: { id } });

    expect(req.valid?.params).toEqual({ id });
  });

  it('parses only what the route declared', () => {
    const { req } = run(validate({ body: Body }), {
      body: { price: 1, km: 2 },
      query: { anything: 'goes' },
    });

    expect(req.valid?.query).toBeUndefined();
  });

  it('declaring nothing passes everything through', () => {
    const { req, error } = run(validate({}), { body: { whatever: true } });

    expect(error).toBeUndefined();
    expect(req.valid).toEqual({});
  });

  /** Two validate() calls on one route must compose rather than clobber. */
  it('merges with values a previous validate() already stored', () => {
    const request = {
      body: { price: 1, km: 2 },
      query: { limit: '5' },
      params: {},
    } as unknown as Request;

    validate({ body: Body })(request, {} as Response, vi.fn());
    validate({ query: Query })(request, {} as Response, vi.fn());

    expect(request.valid).toEqual({ body: { price: 1, km: 2 }, query: { limit: 5 } });
  });
});

describe('failures', () => {
  it('forwards a ZodError rather than throwing', () => {
    const { error } = run(validate({ body: Body }), { body: { price: 'lots' } });

    expect(error).toBeInstanceOf(ZodError);
  });

  /** One round trip, every mistake — the reason issues are collected, not short-circuited. */
  it('collects issues from body, query and params together', () => {
    const { error } = run(validate({ body: Body, query: Query, params: Params }), {
      body: { price: 'lots' },
      query: { limit: 'many' },
      params: { id: 'not-a-uuid' },
    });

    const paths = (error as ZodError).issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('body.price');
    expect(paths).toContain('query.limit');
    expect(paths).toContain('params.id');
  });

  it('prefixes each path with its source so `errors[].field` reads body.price', () => {
    const { error } = run(validate({ body: Body }), { body: { price: 'lots', km: 'lots' } });

    expect((error as ZodError).issues.map((issue) => issue.path.join('.'))).toEqual([
      'body.price',
      'body.km',
    ]);
  });

  it('prefixes a nested path too', () => {
    const schema = z.object({ pricing: z.object({ amount: z.number() }) });

    const { error } = run(validate({ body: schema }), { body: { pricing: { amount: 'x' } } });

    expect((error as ZodError).issues[0]?.path.join('.')).toBe('body.pricing.amount');
  });

  it('stores nothing when any source failed', () => {
    const { req } = run(validate({ body: Body, query: Query }), {
      body: { price: 1, km: 2 },
      query: { limit: 'many' },
    });

    expect(req.valid).toBeUndefined();
  });

  it('leaves req.body as the caller sent it when the body failed', () => {
    const { req } = run(validate({ body: Body }), { body: { price: 'lots' } });

    expect(req.body).toEqual({ price: 'lots' });
  });

  /**
   * §9.2: an unknown parameter is a 400, never a silent ignore — silent
   * ignoring hides a frontend bug for months.
   */
  it('rejects a surplus key when the schema is strict', () => {
    const strict = z.object({ limit: z.coerce.number() }).strict();

    const { error } = run(validate({ query: strict }), { query: { limit: '5', lmit: '9' } });

    expect(error).toBeInstanceOf(ZodError);
    expect((error as ZodError).issues[0]?.code).toBe('unrecognized_keys');
  });

  it('preserves the original issue code alongside the new path', () => {
    const { error } = run(validate({ body: Body }), { body: { price: 'lots', km: 1 } });

    expect((error as ZodError).issues[0]).toMatchObject({
      code: 'invalid_type',
      path: ['body', 'price'],
    });
  });
});

describe('validated()', () => {
  it('returns the parsed value', () => {
    const { req } = run(validate({ query: Query }), { query: { limit: '24' } });

    expect(validated<{ limit: number }>(req, 'query')).toEqual({ limit: 24 });
  });

  /**
   * A programmer error, not a client error: returning undefined here would let
   * a handler run with no filters at all rather than fail loudly.
   */
  it('throws when the route never declared that schema', () => {
    const { req } = run(validate({ body: Body }), { body: { price: 1, km: 2 } });

    expect(() => validated(req, 'query')).toThrow(
      'No validated "query" on this request. Add validate({ query: Schema }) to the route.',
    );
  });

  it('throws when validate() never ran at all', () => {
    expect(() => validated({} as Request, 'body')).toThrow('No validated "body" on this request.');
  });

  it('names the source it was asked for', () => {
    expect(() => validated({} as Request, 'params')).toThrow('validate({ params: Schema })');
  });

  /** A legitimately empty parse result is a value, not an absence. */
  it('returns an empty object rather than throwing on it', () => {
    const { req } = run(validate({ query: z.object({}) }), { query: {} });

    expect(validated(req, 'query')).toEqual({});
  });
});
