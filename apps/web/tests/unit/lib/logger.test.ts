import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';
import { describeError, logger } from '@/lib/logger';

/**
 * The web app's only way to write diagnostics (production source has no
 * `console`). One JSON line per event, to stderr for errors, carrying what an
 * engineer needs to correlate the failure — category and API trace id —
 * without arbitrary error text, request payloads or URL query values.
 */
describe('logger', () => {
  it('writes one JSON line to stderr for an error', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('api.request_failed', { method: 'GET', path: '/v1/vehicles' });

    const line = String(write.mock.calls[0]?.[0]);
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toMatchObject({
      level: 'error',
      event: 'api.request_failed',
      method: 'GET',
      path: '/v1/vehicles',
    });
  });

  it('writes a warning to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.warn('home.inventory_unavailable');
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({ level: 'warn' });
  });
});

describe('describeError', () => {
  it('keeps diagnostic metadata and cause categories without arbitrary text', () => {
    const error = new ApiError({
      type: 'about:blank',
      title: 'Internal',
      status: 500,
      code: 'INTERNAL',
      traceId: 'T9',
    });
    const described = describeError(new Error('outer', { cause: error }));

    expect(described).toMatchObject({
      name: 'Error',
      cause: { name: 'ApiError', status: 500, code: 'INTERNAL', traceId: 'T9' },
    });
    expect(described).not.toHaveProperty('message');
    expect(described).not.toHaveProperty('stack');
  });

  it('does not serialize a thrown string that can contain credentials', () => {
    expect(describeError('boom')).toEqual({ name: 'NonError', type: 'string' });
  });

  it('never writes credentials from error text, query parameters or extra fields', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('api.request_failed', {
      method: 'POST',
      path: '/v1/auth/sign-in?accessToken=private-query-proof',
      error: new Error('private-error-proof', { cause: new Error('private-cause-proof') }),
      cookie: 'private-cookie',
      body: { accessToken: 'private-body-proof' },
    });
    const line = String(write.mock.calls[0]?.[0]);
    expect(line).not.toMatch(/private-|accessToken|cookie|body/);
    expect(JSON.parse(line)).toMatchObject({
      method: 'POST',
      path: '/v1/auth/sign-in',
      error: { name: 'Error', cause: { name: 'Error' } },
    });
  });

  it('does not crash logging when error causes form a cycle', () => {
    const error = new Error('private-text');
    error.cause = error;
    expect(describeError(error)).toEqual({
      name: 'Error',
      cause: { name: 'Error', circular: true },
    });
  });
});
