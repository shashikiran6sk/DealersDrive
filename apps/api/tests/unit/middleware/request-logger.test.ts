import { EventEmitter } from 'node:events';

import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../../../src/middleware/request-logger.js';
import { logger } from '../../../src/platform/telemetry/logger.js';

/**
 * One line per completed request, and one detail in it that is easy to get
 * wrong: the *path* is captured before `next()`, not inside the `finish`
 * handler. Express rewrites `req.url` while routing into a mounted router and
 * `finish` can fire before it is restored, so reading it late would classify
 * `/health/live` as an ordinary request and flood dev output with probe noise
 * every few seconds.
 */

function fakeRes(statusCode = 200): Response & EventEmitter {
  const emitter = new EventEmitter() as Response & EventEmitter;
  emitter.statusCode = statusCode;
  return emitter;
}

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/v1/vehicles',
    originalUrl: '/v1/vehicles',
    ...overrides,
  } as Request;
}

let info: ReturnType<typeof vi.spyOn>;
let debug: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  debug = vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestLogger', () => {
  it('calls next immediately rather than waiting for the response', () => {
    const next = vi.fn() as unknown as NextFunction;

    requestLogger(fakeReq(), fakeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('logs nothing until the response finishes', () => {
    requestLogger(fakeReq(), fakeRes(), vi.fn());

    expect(info).not.toHaveBeenCalled();
  });

  it('logs one line on finish', () => {
    const res = fakeRes();
    requestLogger(fakeReq(), res, vi.fn());

    res.emit('finish');

    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0]?.[1]).toBe('request completed');
  });

  it('records method, url, status and duration', () => {
    const res = fakeRes(201);
    requestLogger(fakeReq({ method: 'POST', originalUrl: '/v1/dealer/vehicles' }), res, vi.fn());

    res.emit('finish');

    expect(info.mock.calls[0]?.[0]).toMatchObject({
      method: 'POST',
      url: '/v1/dealer/vehicles',
      status: 201,
    });
  });

  it('reports the status the response actually ended with', () => {
    const res = fakeRes(200);
    requestLogger(fakeReq(), res, vi.fn());
    res.statusCode = 422;

    res.emit('finish');

    expect((info.mock.calls[0]?.[0] as { status: number }).status).toBe(422);
  });

  it('rounds the duration to two decimals rather than logging a long float', () => {
    const res = fakeRes();
    requestLogger(fakeReq(), res, vi.fn());

    res.emit('finish');

    const { durationMs } = info.mock.calls[0]?.[0] as { durationMs: number };
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(Number(durationMs.toFixed(2))).toBe(durationMs);
  });

  /** Probes fire every few seconds; at info they would drown the dev log. */
  it.each(['/health/live', '/health/ready'])('logs %s at debug', (path) => {
    const res = fakeRes();
    requestLogger(fakeReq({ path, originalUrl: path }), res, vi.fn());

    res.emit('finish');

    expect(debug).toHaveBeenCalledOnce();
    expect(info).not.toHaveBeenCalled();
  });

  it('logs an ordinary health endpoint at info — only the probes are quiet', () => {
    const res = fakeRes();
    requestLogger(fakeReq({ path: '/health', originalUrl: '/health' }), res, vi.fn());

    res.emit('finish');

    expect(info).toHaveBeenCalledOnce();
  });

  /**
   * The reason `path` is read before `next()`. If a later edit moved that read
   * inside the finish handler, a probe whose `req.path` had been rewritten to
   * `/live` by the mounted router would start logging at info.
   */
  it('classifies by the path as it was at entry, not as rewritten by routing', () => {
    const req = fakeReq({ path: '/health/live', originalUrl: '/health/live' });
    const res = fakeRes();

    requestLogger(req, res, vi.fn());
    (req as { path: string }).path = '/live';
    res.emit('finish');

    expect(debug).toHaveBeenCalledOnce();
    expect(info).not.toHaveBeenCalled();
  });

  it('logs originalUrl, not the rewritten url', () => {
    const res = fakeRes();
    requestLogger(fakeReq({ path: '/vehicles', originalUrl: '/v1/dealer/vehicles' }), res, vi.fn());

    res.emit('finish');

    expect((info.mock.calls[0]?.[0] as { url: string }).url).toBe('/v1/dealer/vehicles');
  });

  it('logs once per request even with several in flight', () => {
    const first = fakeRes();
    const second = fakeRes();

    requestLogger(fakeReq({ originalUrl: '/a' }), first, vi.fn());
    requestLogger(fakeReq({ originalUrl: '/b' }), second, vi.fn());
    second.emit('finish');
    first.emit('finish');

    expect(info).toHaveBeenCalledTimes(2);
    expect((info.mock.calls[0]?.[0] as { url: string }).url).toBe('/b');
    expect((info.mock.calls[1]?.[0] as { url: string }).url).toBe('/a');
  });
});
