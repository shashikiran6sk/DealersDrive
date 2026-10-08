import { PublicStorefrontDto } from '@dealers-drive/contracts';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SITE } from '../../../packages/storefront-ui/tests/fixtures.js';
import { middleware } from '../src/middleware.js';

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'https://api.example.com');
  vi.stubEnv('STOREFRONT_SERVICE_SECRET', 'synthetic-server-secret-32-characters');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function request(host = 'alpha.example.com') {
  return new NextRequest('https://alpha.example.com/cars?q=honda', {
    headers: {
      host,
      'x-forwarded-host': 'evil.example.com',
      'x-dd-pathname': '//evil.example.com',
      'x-dd-storefront-secret': 'forged',
    },
  });
}
describe('pre-stream tenant and canonical boundary', () => {
  it('returns a real noindex 404 before streaming unknown tenant HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 }))),
    );
    const res = await middleware(request());
    expect(res.status).toBe(404);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
  it('distinguishes infrastructure failure from unknown tenants', async () => {
    for (const response of [
      new Response('', { status: 503 }),
      Response.json({ wrong: 'shape' }),
      new Response('bad json'),
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(response)),
      );
      expect((await middleware(request())).status).toBe(503);
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    expect((await middleware(request())).status).toBe(503);
    vi.stubEnv('STOREFRONT_SERVICE_SECRET', '');
    expect((await middleware(request())).status).toBe(503);
    expect(PublicStorefrontDto.safeParse(SITE).success).toBe(true);
  });
  it('overwrites forged route headers and canonicalizes only registered primary origins', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json(SITE))),
    );
    const allowed = await middleware(request());
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('x-middleware-request-x-dd-pathname')).toBe('/cars');
    expect(allowed.headers.get('x-middleware-request-x-dd-storefront-secret')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ ...SITE, primaryHostname: 'primary.example.com' })),
      ),
    );
    const redirect = await middleware(request());
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get('location')).toBe('https://primary.example.com/cars?q=honda');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ ...SITE, requestedHostname: 'beta.example.com' })),
      ),
    );
    expect((await middleware(request())).status).toBe(503);
  });
  it('rejects malformed real-host syntax even if forwarded-host is valid', async () => {
    expect((await middleware(request('alpha.example.com:bad'))).status).toBe(404);
  });
});
