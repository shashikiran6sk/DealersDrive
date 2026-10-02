import { describe, expect, it } from 'vitest';

import { ApiError, UpstreamUnavailableError } from '@/lib/api';
import { categoryOf, isMissingResource, isServerFailure, safeMessage } from '@/lib/errors';

/**
 * The one decision every page and action makes about a failure: which kind it
 * was. The distinction that matters most is the first row against the last
 * two — a car that does not exist is a 404, and an API that could not say is
 * never one.
 */
function api(status: number, code = 'X'): ApiError {
  return new ApiError({ type: 'about:blank', title: 't', status, code });
}

describe('categoryOf', () => {
  it.each([
    [404, 'RESOURCE_NOT_FOUND'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [400, 'VALIDATION'],
    [422, 'VALIDATION'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'SERVICE_UNAVAILABLE'],
    [503, 'SERVICE_UNAVAILABLE'],
    [504, 'SERVICE_UNAVAILABLE'],
  ] as const)('reads an API %i as %s', (status, category) => {
    expect(categoryOf(api(status))).toBe(category);
  });

  it.each(['network', 'timeout', 'malformed'] as const)(
    'reads an unreachable API (%s) as SERVICE_UNAVAILABLE',
    (kind) => {
      expect(categoryOf(new UpstreamUnavailableError(kind, 'GET', '/v1/x'))).toBe(
        'SERVICE_UNAVAILABLE',
      );
    },
  );

  it('reads anything else — a bug, a contract mismatch — as INTERNAL_ERROR', () => {
    expect(categoryOf(new TypeError('x is undefined'))).toBe('INTERNAL_ERROR');
    expect(categoryOf('a string')).toBe('INTERNAL_ERROR');
  });
});

describe('isMissingResource', () => {
  it('is true only for a 404 the API answered', () => {
    expect(isMissingResource(api(404))).toBe(true);
    expect(isMissingResource(api(500))).toBe(false);
    expect(isMissingResource(api(503))).toBe(false);
    expect(isMissingResource(new UpstreamUnavailableError('network', 'GET', '/v1/x'))).toBe(false);
    expect(isMissingResource(new UpstreamUnavailableError('timeout', 'GET', '/v1/x'))).toBe(false);
    expect(isMissingResource(new Error('fetch failed'))).toBe(false);
  });

  it('treats a rejected identifier as missing only when asked to', () => {
    expect(isMissingResource(api(400))).toBe(false);
    expect(isMissingResource(api(400), { invalidIdentifier: true })).toBe(true);
    expect(isMissingResource(api(500), { invalidIdentifier: true })).toBe(false);
  });
});

describe('isServerFailure', () => {
  it('is the outage and the bug, never the answer', () => {
    expect(isServerFailure(api(500))).toBe(true);
    expect(isServerFailure(new UpstreamUnavailableError('network', 'GET', '/v1/x'))).toBe(true);
    expect(isServerFailure(new Error('bug'))).toBe(true);
    expect(isServerFailure(api(404))).toBe(false);
    expect(isServerFailure(api(401))).toBe(false);
    expect(isServerFailure(api(422))).toBe(false);
  });
});

describe('safeMessage', () => {
  it('is a sentence of our own, whatever the error carried', () => {
    const leaky = new ApiError({
      type: 'about:blank',
      title: 'Internal',
      status: 500,
      code: 'INTERNAL',
      detail: "PrismaClientInitializationError: Can't reach database server",
    });

    expect(safeMessage(leaky)).toBe('Something went wrong. Please try again.');
    expect(safeMessage(new UpstreamUnavailableError('timeout', 'GET', '/v1/x'))).toBe(
      'This service is temporarily unavailable. Please try again.',
    );
  });
});
