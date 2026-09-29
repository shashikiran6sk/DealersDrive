import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';
import { describeError, logger } from '@/lib/logger';

/**
 * The web app's only way to write diagnostics (production source has no
 * `console`). One JSON line per event, to stderr for errors, carrying what an
 * engineer needs to find the failure — the error's name, message, stack, and
 * the API's trace id — and nothing the caller did not pass.
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
  it('keeps the diagnostic fields and the cause', () => {
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
      message: 'outer',
      cause: { name: 'ApiError', status: 500, code: 'INTERNAL', traceId: 'T9' },
    });
    expect(typeof described.stack).toBe('string');
  });

  it('describes a thrown non-error as its string form', () => {
    expect(describeError('boom')).toEqual({ value: 'boom' });
  });
});
