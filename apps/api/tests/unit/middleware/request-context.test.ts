import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  getContext,
  getTraceId,
  inboundTraceId,
  requestContext,
  requireContext,
  runWithContext,
  sanitizeTraceId,
  setContextValue,
  TRACE_ID_HEADER,
  type RequestContext,
} from '../../../src/middleware/request-context.js';

/**
 * AsyncLocalStorage is what lets `getTraceId()` work five frames deep inside a
 * service without threading a parameter through every signature. The property
 * worth testing is that the store survives `await` — that is the entire reason
 * this is ALS rather than a module-level variable, and the reason two
 * concurrent requests never see each other's dealerId.
 */

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '203.0.113.9',
    socket: { remoteAddress: '203.0.113.9' },
    ...overrides,
  } as Request;
}

function fakeRes(): { res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    res: {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    } as unknown as Response,
  };
}

describe('outside a request', () => {
  it('getContext() is undefined rather than throwing', () => {
    expect(getContext()).toBeUndefined();
  });

  it('getTraceId() is undefined so boot-time logs simply omit it', () => {
    expect(getTraceId()).toBeUndefined();
  });

  it('requireContext() throws, for code that cannot continue without one', () => {
    expect(() => requireContext()).toThrow('requireContext() called outside of a request scope');
  });

  it('setContextValue() is a silent no-op, not a crash', () => {
    expect(() => {
      setContextValue('dealerId', 'd1');
    }).not.toThrow();
  });
});

describe('runWithContext', () => {
  it('makes the context visible to everything it calls', () => {
    const seen = runWithContext({ traceId: 't1', ip: '1.1.1.1' }, () => getContext());

    expect(seen).toEqual({ traceId: 't1', ip: '1.1.1.1' });
  });

  it('returns whatever the function returns', () => {
    expect(runWithContext({ traceId: 't1', ip: '1.1.1.1' }, () => 42)).toBe(42);
  });

  it('requireContext() succeeds inside', () => {
    expect(runWithContext({ traceId: 't1', ip: '1.1.1.1' }, () => requireContext().traceId)).toBe(
      't1',
    );
  });

  it('restores the previous absence of a context afterwards', () => {
    runWithContext({ traceId: 't1', ip: '1.1.1.1' }, () => getContext());

    expect(getContext()).toBeUndefined();
  });

  it('survives an await — the reason this is ALS and not a global', async () => {
    const seen = await runWithContext({ traceId: 't-async', ip: '1.1.1.1' }, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      return getTraceId();
    });

    expect(seen).toBe('t-async');
  });

  /**
   * Two overlapping requests must never see each other's tenant. If this ever
   * fails, the dealerId in a log line — and worse, anything that reads it to
   * scope a query — belongs to the wrong dealership.
   */
  it('keeps concurrent scopes separate', async () => {
    const one = runWithContext({ traceId: 'a', ip: '1.1.1.1', dealerId: 'dealer-a' }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getContext()?.dealerId;
    });
    const two = runWithContext({ traceId: 'b', ip: '2.2.2.2', dealerId: 'dealer-b' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return getContext()?.dealerId;
    });

    expect(await Promise.all([one, two])).toEqual(['dealer-a', 'dealer-b']);
  });

  it('nests, innermost winning', () => {
    const seen = runWithContext({ traceId: 'outer', ip: '1.1.1.1' }, () =>
      runWithContext({ traceId: 'inner', ip: '1.1.1.1' }, () => getTraceId()),
    );

    expect(seen).toBe('inner');
  });
});

describe('setContextValue', () => {
  it('attaches identity to the live context without re-running middleware', () => {
    const seen = runWithContext({ traceId: 't', ip: '1.1.1.1' }, () => {
      setContextValue('userId', 'user-1');
      setContextValue('dealerId', 'dealer-1');
      return getContext();
    });

    expect(seen).toMatchObject({ userId: 'user-1', dealerId: 'dealer-1' });
  });

  it('is visible to code that runs after the await that set it', async () => {
    const seen = await runWithContext({ traceId: 't', ip: '1.1.1.1' }, async () => {
      await Promise.resolve();
      setContextValue('dealerId', 'dealer-late');
      await Promise.resolve();
      return getContext()?.dealerId;
    });

    expect(seen).toBe('dealer-late');
  });

  it('overwrites a value already present', () => {
    const seen = runWithContext({ traceId: 't', ip: '1.1.1.1', dealerId: 'old' }, () => {
      setContextValue('dealerId', 'new');
      return getContext()?.dealerId;
    });

    expect(seen).toBe('new');
  });
});

describe('the Express middleware', () => {
  it('creates a context and calls next inside it', () => {
    const { res } = fakeRes();
    const next = vi.fn(() => {
      expect(getContext()).toBeDefined();
    }) as unknown as NextFunction;

    requestContext(fakeReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('mints a 10-character traceId', () => {
    const { res } = fakeRes();
    let traceId: string | undefined;

    requestContext(fakeReq(), res, (() => {
      traceId = getTraceId();
    }) as NextFunction);

    expect(traceId).toMatch(/^[\w-]{10}$/);
  });

  it('gives each request its own traceId', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      requestContext(fakeReq(), fakeRes().res, (() => {
        ids.add(getTraceId() ?? '');
      }) as NextFunction);
    }

    expect(ids.size).toBe(5);
  });

  /** So a dealer's support ticket can quote an id they can actually see. */
  it('echoes the traceId back as a response header', () => {
    const { res, headers } = fakeRes();
    let traceId: string | undefined;

    requestContext(fakeReq(), res, (() => {
      traceId = getTraceId();
    }) as NextFunction);

    expect(headers[TRACE_ID_HEADER]).toBe(traceId);
  });

  it('sets the header before next runs, so even a thrown error carries it', () => {
    const { res, headers } = fakeRes();

    requestContext(fakeReq(), res, (() => {
      expect(headers[TRACE_ID_HEADER]).toBeDefined();
    }) as NextFunction);
  });

  it('records req.ip when Express resolved one', () => {
    let ip: string | undefined;

    requestContext(fakeReq({ ip: '198.51.100.4' }), fakeRes().res, (() => {
      ip = getContext()?.ip;
    }) as NextFunction);

    expect(ip).toBe('198.51.100.4');
  });

  it('falls back to the socket address when req.ip is undefined', () => {
    let ip: string | undefined;
    const req = { ip: undefined, socket: { remoteAddress: '10.0.0.7' } } as unknown as Request;

    requestContext(req, fakeRes().res, (() => {
      ip = getContext()?.ip;
    }) as NextFunction);

    expect(ip).toBe('10.0.0.7');
  });

  it("records 'unknown' rather than undefined when neither is available", () => {
    let ip: string | undefined;
    const req = { ip: undefined, socket: {} } as unknown as Request;

    requestContext(req, fakeRes().res, (() => {
      ip = getContext()?.ip;
    }) as NextFunction);

    expect(ip).toBe('unknown');
  });

  it('starts with no identity — auth attaches that later', () => {
    let context: ReturnType<typeof getContext>;

    requestContext(fakeReq(), fakeRes().res, (() => {
      context = getContext();
    }) as NextFunction);

    expect(context?.userId).toBeUndefined();
    expect(context?.dealerId).toBeUndefined();
  });
});

describe('sanitizeTraceId', () => {
  /**
   * An inbound id is untrusted input that ends up in every log line for the
   * request, so it is filtered rather than trusted. The newline is the one that
   * matters: without it, a caller can forge a second log entry.
   */
  it('keeps an ordinary id unchanged', () => {
    expect(sanitizeTraceId('abc123XYZ')).toBe('abc123XYZ');
  });

  it('keeps the characters real tracing headers use', () => {
    expect(sanitizeTraceId('Root=1-5759e988-bd862e3fe1be46a994272793')).toBe(
      'Root=1-5759e988-bd862e3fe1be46a994272793',
    );
  });

  it('strips a newline, so a caller cannot forge a second log line', () => {
    // `:` survives — it appears in real tracing formats and cannot break a log
    // line. The newline, the braces and the quotes are what had to go.
    expect(sanitizeTraceId('abc\n{"level":"fatal"}')).toBe('abclevel:fatal');
  });

  it('strips quotes, which would otherwise break the JSON a shipper parses', () => {
    expect(sanitizeTraceId('a"b')).toBe('ab');
  });

  it('strips control characters, including a terminal escape', () => {
    expect(sanitizeTraceId('ab\u001b[31m')).toBe('ab31m');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeTraceId('  abc  ')).toBe('abc');
  });

  it('caps the length, so one header cannot bloat every log line', () => {
    expect(sanitizeTraceId('a'.repeat(500))).toHaveLength(64);
  });

  it('rejects an empty or absent value', () => {
    expect(sanitizeTraceId(undefined)).toBeUndefined();
    expect(sanitizeTraceId('')).toBeUndefined();
    expect(sanitizeTraceId('   ')).toBeUndefined();
  });

  it('rejects a value that is nothing but disallowed characters', () => {
    expect(sanitizeTraceId('<<>>')).toBeUndefined();
  });
});

describe('inboundTraceId', () => {
  it('is undefined when nothing was sent', () => {
    expect(inboundTraceId({})).toBeUndefined();
    expect(inboundTraceId(undefined)).toBeUndefined();
  });

  it('prefers x-request-id', () => {
    expect(inboundTraceId({ 'x-request-id': 'from-alb', 'x-correlation-id': 'other' })).toBe(
      'from-alb',
    );
  });

  /**
   * `x-amzn-trace-id` is last because the ALB sets it on *every* request.
   * Taking it first would mean an id the web app's BFF supplied deliberately
   * was always ignored, and the two halves of one user action would never join.
   */
  it('prefers a deliberate id over the ALB default', () => {
    expect(
      inboundTraceId({ 'x-amzn-trace-id': 'Root=1-abc', 'x-correlation-id': 'from-bff' }),
    ).toBe('from-bff');
  });

  it('falls back to the ALB id when nothing else was sent', () => {
    expect(inboundTraceId({ 'x-amzn-trace-id': 'Root=1-abc' })).toBe('Root=1-abc');
  });

  it('takes the first value of a repeated header', () => {
    expect(inboundTraceId({ 'x-request-id': ['first', 'second'] })).toBe('first');
  });

  it('skips a header whose value sanitizes away and tries the next', () => {
    expect(inboundTraceId({ 'x-request-id': '<<>>', 'x-correlation-id': 'usable' })).toBe('usable');
  });
});

describe('adopting an inbound id', () => {
  function run(headers: Record<string, string | string[]>): {
    context: RequestContext | undefined;
    headersSet: Record<string, unknown>;
  } {
    const headersSet: Record<string, unknown> = {};
    let context: RequestContext | undefined;

    requestContext(
      { headers, socket: {} } as unknown as Request,
      {
        setHeader: (name: string, value: unknown) => {
          headersSet[name] = value;
        },
      } as unknown as Response,
      (() => {
        context = getContext();
      }) as NextFunction,
    );

    return { context, headersSet };
  }

  it('adopts the inbound id, so one request has one id end to end', () => {
    const { context } = run({ 'x-request-id': 'edge-123' });

    expect(context?.traceId).toBe('edge-123');
    expect(context?.traceInherited).toBe(true);
  });

  it('mints its own when the caller sent none', () => {
    const { context } = run({});

    expect(context?.traceId).toHaveLength(10);
    expect(context?.traceInherited).toBe(false);
  });

  it('never adopts an unsanitary id', () => {
    const { context } = run({ 'x-request-id': 'bad\nvalue"here' });

    expect(context?.traceId).toBe('badvaluehere');
  });

  /** Echoed under both names: ours, and the one every log shipper looks for. */
  it('echoes the id back under both header names', () => {
    const { context, headersSet } = run({ 'x-request-id': 'edge-123' });

    expect(headersSet['x-trace-id']).toBe(context?.traceId);
    expect(headersSet['x-request-id']).toBe(context?.traceId);
  });
});
