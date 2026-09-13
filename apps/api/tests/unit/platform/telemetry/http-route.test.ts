import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { normalizedHttpRoute } from '../../../../src/platform/telemetry/http-route.js';

function request(originalUrl: string, route?: string): Request {
  return { originalUrl, route: route === undefined ? undefined : { path: route } } as Request;
}

describe('normalizedHttpRoute', () => {
  it('reconstructs nested router prefixes without retaining parameter values', () => {
    expect(
      normalizedHttpRoute(request('/v1/admin/dealers/dealer-123/approve', '/dealers/:id/approve')),
    ).toBe('/v1/admin/dealers/:id/approve');
  });

  it('normalizes a router root to its full mount point', () => {
    expect(normalizedHttpRoute(request('/v1/dealer', '/'))).toBe('/v1/dealer');
  });

  it('uses one bounded label for paths that did not match a route', () => {
    expect(normalizedHttpRoute(request('/v1/private-value'))).toBe('unmatched');
  });

  it('ignores query parameters when rebuilding a route', () => {
    expect(normalizedHttpRoute(request('/v1/dealers/foo?q=secret', '/dealers/:slug'))).toBe(
      '/v1/dealers/:slug',
    );
  });
});
