import { describe, expect, it, vi } from 'vitest';

import { ApiError, UpstreamUnavailableError } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

/**
 * What the browser is told when a BFF route's upstream call fails. The API's
 * own 4xx answers are its contract with the client — the code, the field
 * errors — and pass through. Anything else is the server's business: the
 * browser gets a status that says which kind of failure it was and a sentence
 * that says nothing about how.
 */
async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('problemResponse', () => {
  it('relays a 4xx problem with its code and field errors', async () => {
    const response = problemResponse(
      new ApiError({
        type: 'about:blank',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        detail: 'The request did not match the expected shape.',
        errors: [{ field: 'body.bytes', code: 'TOO_BIG', message: 'That file is too large.' }],
        traceId: 'T1',
      }),
      '/api/test',
    );

    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'The request did not match the expected shape.',
      errors: [{ field: 'body.bytes', code: 'TOO_BIG', message: 'That file is too large.' }],
      traceId: 'T1',
    });
  });

  it('never forwards what an upstream 500 said', async () => {
    const response = problemResponse(
      new ApiError({
        type: 'about:blank',
        title: 'Internal server error',
        status: 500,
        code: 'INTERNAL',
        detail: "PrismaClientInitializationError: Can't reach database server at db.internal:5432",
        traceId: 'T2',
      }),
      '/api/test',
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|db\.internal|5432/);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Internal error',
      status: 502,
      code: 'INTERNAL_ERROR',
      detail: 'Something went wrong. Please try again.',
      traceId: 'T2',
    });
  });

  it('keeps an upstream 503 a 503, and says the service is unavailable', async () => {
    const response = problemResponse(
      new ApiError({ type: 'x', title: 'Unavailable', status: 503, code: 'NOT_READY' }),
      '/api/test',
    );
    expect(response.status).toBe(503);
    expect(await bodyOf(response)).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      detail: 'This service is temporarily unavailable. Please try again.',
    });
  });

  it.each([
    ['network', 502],
    ['malformed', 502],
    ['timeout', 504],
  ] as const)('answers an unreachable API (%s) with %i', async (kind, status) => {
    const response = problemResponse(
      new UpstreamUnavailableError(
        kind,
        'GET',
        '/v1/x',
        new Error('connect ECONNREFUSED 10.0.0.4:4000'),
      ),
      '/api/test',
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(status);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.4/);
  });

  it('answers a bug with a 500 that says nothing about it, and logs it', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const response = problemResponse(
      new TypeError("Cannot read properties of undefined (reading 'x')"),
      '/api/test',
    );

    expect(response.status).toBe(500);
    expect(JSON.stringify(await bodyOf(response))).not.toContain('Cannot read');
    expect(String(write.mock.calls[0]?.[0])).toContain('bff.unexpected_failure');
  });
});
