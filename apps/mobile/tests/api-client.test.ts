import { z } from 'zod';

import { ApiError, createApiClient } from '../src/services/api';

const Resource = z.object({ value: z.string() });

function reply(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function fixture() {
  const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  return {
    fetcher,
    client: createApiClient({ baseUrl: 'https://api.dealers-drive.com', fetcher, timeoutMs: 20 }),
  };
}

describe('native public API client', () => {
  it('validates data without forwarding browser cookies or credentials', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockResolvedValue(reply({ value: 'car' }));
    await expect(client.get('/v1/vehicles?q=creta', Resource)).resolves.toEqual({ value: 'car' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.dealers-drive.com/v1/vehicles?q=creta',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it.each([
    'https://outside.example/v1/vehicles',
    '//outside.example/v1/vehicles',
    '/v1/../../private',
    '/v1/\\outside',
  ])('refuses an endpoint escaping the service', async (path) => {
    const { client, fetcher } = fixture();
    await expect(client.get(path, Resource)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('retains rate-limit and safe request correlation details', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockResolvedValue(
      reply(
        {
          type: 'about:blank',
          title: 'Too many requests',
          status: 429,
          code: 'RATE_LIMITED',
          traceId: 'safe-request',
          detail: 'Try again shortly.',
        },
        429,
        { 'Retry-After': '30' },
      ),
    );
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
      problem: { traceId: 'safe-request' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not expose raw server diagnostic text', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockResolvedValue(
      reply(
        {
          type: 'about:blank',
          title: 'Failure',
          status: 500,
          code: 'INTERNAL',
          detail: 'private database diagnostic',
        },
        500,
      ),
    );
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      code: 'INTERNAL',
      message: 'Something went wrong on our side. Please try again in a moment.',
    });
  });

  it('handles HTML infrastructure errors as API errors', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockResolvedValue(new Response('<html>gateway</html>', { status: 503 }));
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      status: 503,
      code: 'REQUEST_FAILED',
    });
  });

  it('refuses malformed or contract-incompatible successful responses', async () => {
    const { client, fetcher } = fixture();
    fetcher
      .mockResolvedValueOnce(new Response('not-json'))
      .mockResolvedValueOnce(reply({ unexpected: true }));
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps provider-independent network failures without raw exception messages', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockRejectedValue(new Error('private networking diagnostic'));
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      code: 'NETWORK_UNAVAILABLE',
    });
  });

  it('times out and aborts a hanging transport', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(client.get('/v1/vehicles', Resource)).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
    });
  });

  it('distinguishes caller cancellation from network failure', async () => {
    const { client, fetcher } = fixture();
    fetcher.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const cancellation = new AbortController();
    const request = client.get('/v1/vehicles', Resource, cancellation.signal);
    cancellation.abort();
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  });
});

it('sends opaque credentials only on customer routes and never on privileged/workspace endpoints', async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const client = createApiClient({ baseUrl: 'https://api.example.com', fetcher });
  const token = 'T'.repeat(43);
  await client.customer('/v1/auth/native/customer/me', z.object({ ok: z.boolean() }), token);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/auth/native/customer/me');
  const init = fetcher.mock.calls[0]?.[1];
  expect(init?.credentials).toBe('omit');
  expect(init?.redirect).toBe('error');
  expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
  expect(() => client.customer('/v1/admin/dealers', z.object({}), token)).toThrow();
  expect(() => client.customer('/v1/auth/workspaces', z.object({}), token)).toThrow();
  expect(() => client.customer('/v1/invitations', z.object({}), token)).toThrow();
  expect(() => client.postAuth('/v1/auth/admin/logout', {}, z.object({}))).toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('validates empty logout responses and refuses redirected auth responses', async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const client = createApiClient({ baseUrl: 'https://api.example.com', fetcher });
  expect(
    await client.customer('/v1/auth/native/customer/logout', z.undefined(), 'T'.repeat(43), {
      method: 'POST',
    }),
  ).toBeUndefined();
  const response = new Response(JSON.stringify({ ok: true }));
  Object.defineProperty(response, 'redirected', { value: true });
  fetcher.mockResolvedValueOnce(response);
  await expect(
    client.postAuth(
      '/v1/auth/native/customer/otp',
      { phone: '9845599999' },
      z.object({ ok: z.boolean() }),
    ),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
