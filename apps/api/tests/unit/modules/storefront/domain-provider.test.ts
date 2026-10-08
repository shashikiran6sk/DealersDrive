import { describe, expect, it, vi } from 'vitest';

import { createVercelDomainProvider } from '../../../../src/modules/storefront/domain-provider.vercel.js';
import { publicIpv4 } from '../../../../src/modules/storefront/domain-network.js';

const config = {
  STOREFRONT_DOMAIN_PROVIDER: 'vercel' as const,
  STOREFRONT_VERCEL_TOKEN: 'synthetic-token',
  STOREFRONT_VERCEL_PROJECT_ID: 'prj_storefront_test',
  STOREFRONT_VERCEL_TEAM_ID: 'team_test',
};
const host = 'cars.example.com';
const project = { name: host, projectId: config.STOREFRONT_VERCEL_PROJECT_ID, verified: true };
const settings = {
  misconfigured: false,
  recommendedCNAME: [
    { rank: 2, value: 'second.example.net' },
    { rank: 1, value: 'actual-provider.example.net' },
  ],
  recommendedIPv4: [],
};
function harness() {
  const transport = vi.fn<typeof fetch>();
  const tls = vi.fn(async () => true);
  const ownership = vi.fn(async () => true);
  return {
    transport,
    tls,
    provider: createVercelDomainProvider(config, transport, tls, ownership),
  };
}

describe('supported Vercel provider API boundary', () => {
  it('keeps provider credentials server-side, uses dedicated project/team and refuses existing domains', async () => {
    const h = harness();
    h.transport
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json(project));
    await h.provider.attach(host);
    const calledUrl = h.transport.mock.calls[0]![0];
    expect(
      calledUrl instanceof URL
        ? calledUrl.href
        : calledUrl instanceof Request
          ? calledUrl.url
          : calledUrl,
    ).toBe(
      `https://api.vercel.com/v9/projects/${config.STOREFRONT_VERCEL_PROJECT_ID}/domains/${host}?teamId=team_test`,
    );
    expect(h.transport.mock.calls[1]![1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer synthetic-token' },
      body: JSON.stringify({ name: host }),
    });
    h.transport.mockResolvedValue(Response.json(project));
    await expect(h.provider.attach(host)).rejects.toMatchObject({
      code: 'DOMAIN_EXISTING_DEPLOYMENT',
    });
  });
  it('uses provider-derived DNS records and requires a real certificate check', async () => {
    const h = harness();
    h.transport
      .mockResolvedValueOnce(Response.json(project))
      .mockResolvedValueOnce(Response.json(settings));
    expect(await h.provider.inspect(host)).toMatchObject({
      verified: true,
      configured: true,
      certificateReady: true,
      routing: { type: 'CNAME', name: host, value: 'actual-provider.example.net' },
    });
    expect(h.tls).toHaveBeenCalledWith(host);
    h.transport
      .mockResolvedValueOnce(
        Response.json({
          ...project,
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.example.com', value: 'provider-challenge' },
            { type: 'OTHER', domain: 'unused', value: 'unused' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...project,
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.example.com', value: 'provider-challenge' },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ ...settings, misconfigured: true }));
    expect(await h.provider.inspect(host)).toMatchObject({
      verified: false,
      configured: false,
      certificateReady: false,
      verification: [{ type: 'TXT', name: '_vercel.example.com', value: 'provider-challenge' }],
    });
    expect(h.tls).toHaveBeenCalledTimes(1);
    expect(
      h.transport.mock.calls.some(
        ([url, init]) =>
          (url instanceof URL ? url.href : url instanceof Request ? url.url : url).includes(
            '/verify',
          ) && init?.method === 'POST',
      ),
    ).toBe(true);
  });
  it('supports provider A records and does not invent routing instructions', async () => {
    const h = harness();
    h.transport.mockResolvedValueOnce(Response.json(project)).mockResolvedValueOnce(
      Response.json({
        ...settings,
        recommendedCNAME: [],
        recommendedIPv4: [{ rank: 1, value: ['203.0.113.10'] }],
      }),
    );
    expect((await h.provider.inspect(host)).routing).toEqual({
      type: 'A',
      name: host,
      value: '203.0.113.10',
    });
    h.transport
      .mockResolvedValueOnce(Response.json(project))
      .mockResolvedValueOnce(
        Response.json({ ...settings, recommendedCNAME: [], recommendedIPv4: [] }),
      );
    expect((await h.provider.inspect(host)).routing).toBeNull();
    h.tls.mockResolvedValue(false);
    h.transport
      .mockResolvedValueOnce(Response.json(project))
      .mockResolvedValueOnce(Response.json(settings));
    expect((await h.provider.inspect(host)).certificateReady).toBe(false);
  });
  it('shows the actual ownership challenge when provider verification is still pending', async () => {
    const h = harness();
    h.transport
      .mockResolvedValueOnce(
        Response.json({
          ...project,
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.example.com', value: 'provider-challenge' },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response('verification pending', { status: 400 }))
      .mockResolvedValueOnce(Response.json({ ...settings, misconfigured: true }));
    expect(await h.provider.inspect(host)).toMatchObject({
      verified: false,
      configured: false,
      certificateReady: false,
      verification: [{ type: 'TXT', name: '_vercel.example.com', value: 'provider-challenge' }],
    });
    expect(h.tls).not.toHaveBeenCalled();
  });
  it('uses provider recommended A records for an apex hostname', async () => {
    const h = harness();
    h.transport
      .mockResolvedValueOnce(Response.json({ ...project, apexName: host }))
      .mockResolvedValueOnce(
        Response.json({ ...settings, recommendedIPv4: [{ rank: 1, value: ['76.76.21.21'] }] }),
      );
    expect((await h.provider.inspect(host)).routing).toEqual({
      type: 'A',
      name: host,
      value: '76.76.21.21',
    });
  });
  it('refuses wrong-project and malformed provider responses', async () => {
    const h = harness();
    h.transport
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ...project, name: 'other.com' }));
    await expect(h.provider.attach(host)).rejects.toMatchObject({ status: 503 });
    h.transport.mockResolvedValue(Response.json({ ...project, projectId: 'other-project' }));
    await expect(h.provider.inspect(host)).rejects.toMatchObject({
      code: 'DOMAIN_PROVIDER_CONFLICT',
    });
    h.transport.mockResolvedValue(new Response('bad json'));
    await expect(h.provider.inspect(host)).rejects.toMatchObject({ status: 503 });
  });
  it.each([400, 409, 429, 500, 403])(
    'handles provider HTTP %s without exposing response secrets',
    async (status) => {
      const h = harness();
      h.transport.mockResolvedValue(new Response('provider secret details', { status }));
      await expect(h.provider.remove(host)).rejects.toThrow();
      try {
        await h.provider.remove(host);
      } catch (error) {
        expect(String(error)).not.toContain('provider secret');
      }
    },
  );
  it('handles timeouts, absent configuration and idempotent removal', async () => {
    const h = harness();
    h.transport.mockRejectedValue(new Error('timeout'));
    await expect(h.provider.inspect(host)).rejects.toMatchObject({ status: 503 });
    const disabled = createVercelDomainProvider(
      { ...config, STOREFRONT_DOMAIN_PROVIDER: 'disabled' },
      h.transport,
    );
    expect(disabled.configured).toBe(false);
    await expect(disabled.attach(host)).rejects.toMatchObject({ status: 503 });
    h.transport.mockResolvedValue(new Response('', { status: 404 }));
    await h.provider.remove(host);
    h.transport.mockResolvedValue(new Response(null, { status: 204 }));
    await h.provider.remove(host);
  });
});

describe('certificate probe SSRF boundary', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.1.1',
    '192.168.0.1',
    '169.254.169.254',
    '0.1.1.1',
    '100.64.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    'not-an-ip',
  ])('refuses non-public IPv4 %s', (value) => {
    expect(publicIpv4(value)).toBe(false);
  });
  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1'])(
    'accepts public IPv4 %s',
    (value) => {
      expect(publicIpv4(value)).toBe(true);
    },
  );
});
