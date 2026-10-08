import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SITE } from '../../../packages/storefront-ui/tests/fixtures.js';
import { PublicStorefrontDto } from '@dealers-drive/contracts';

const mocks = vi.hoisted(() => ({ incoming: new Headers(), fetch: vi.fn() }));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(mocks.incoming) }));
import { storefrontRequest } from '../src/lib/api.js';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  mocks.incoming = new Headers({
    host: 'alpha.example.com',
    'x-forwarded-host': 'beta.example.com',
    'x-dd-storefront-secret': 'client-forgery',
  });
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('STOREFRONT_SERVICE_SECRET', 'server-only-service-secret-32-characters');
  vi.stubEnv('API_BASE_URL', 'https://api.example.com');
});

describe('server-only tenant API client', () => {
  it('binds the actual host, overwrites forged service credentials and never caches or sends cookies', async () => {
    mocks.fetch.mockResolvedValue(Response.json(SITE));
    await expect(storefrontRequest(PublicStorefrontDto, '/site')).resolves.toEqual(SITE);
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/storefront/site');
    expect(init).toMatchObject({
      cache: 'no-store',
      headers: {
        'x-dd-storefront-host': 'alpha.example.com',
        'x-dd-storefront-secret': 'server-only-service-secret-32-characters',
      },
    });
    expect(init.headers).not.toHaveProperty('Cookie');
    expect(init.headers).not.toHaveProperty('x-forwarded-host');
  });
  it('fails closed for missing configuration, network failure, inactive sites and malformed responses', async () => {
    vi.stubEnv('STOREFRONT_SERVICE_SECRET', '');
    await expect(storefrontRequest(PublicStorefrontDto, '/site')).rejects.toMatchObject({
      status: 503,
    });
    vi.stubEnv('STOREFRONT_SERVICE_SECRET', 'server-only-service-secret-32-characters');
    mocks.fetch.mockRejectedValue(new Error('network down'));
    await expect(storefrontRequest(PublicStorefrontDto, '/site')).rejects.toMatchObject({
      status: 503,
    });
    mocks.fetch.mockResolvedValue(new Response('', { status: 404 }));
    await expect(storefrontRequest(PublicStorefrontDto, '/site')).rejects.toMatchObject({
      status: 404,
    });
    mocks.fetch.mockResolvedValue(Response.json({ ...SITE, theme: 'UNSAFE' }));
    await expect(storefrontRequest(PublicStorefrontDto, '/site')).rejects.toMatchObject({
      status: 503,
    });
  });
});
