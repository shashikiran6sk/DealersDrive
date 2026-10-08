import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createStorefrontDomains,
  createStorefrontService,
  type DomainProvider,
} from '../src/modules/storefront/storefront.facade.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
import { env } from '../src/config/env.js';
import { ConflictError } from '../src/platform/errors.js';
import {
  createAuthHarness,
  createFakeGoogle,
  createRecordingMailer,
  type AuthHarness,
} from './auth-harness.js';

const stamp = randomUUID().slice(0, 8);
const SECRET = 'domain-test-storefront-secret-32-characters';
let h: AuthHarness;
let owner: ReturnType<AuthHarness['agent']>;
let other: ReturnType<AuthHarness['agent']>;
let dealerId: string;
let userId: string;
let domainId: string;
let originalProof: string;
const host = `cars-${stamp}.example.com`;
const inspection = {
  verified: false,
  configured: false,
  certificateReady: false,
  verification: [
    { type: 'TXT' as const, name: '_vercel.example.com', value: 'synthetic-provider-proof' },
  ],
  routing: { type: 'CNAME' as const, name: host, value: 'provider-derived.example.net' },
};
const provider: DomainProvider = {
  configured: true,
  ownership: vi.fn(async () => false),
  attach: vi.fn(async () => undefined),
  inspect: vi.fn(async () => ({ ...inspection })),
  remove: vi.fn(async () => undefined),
};

async function dealer(name: string) {
  h.google.claims = {
    subject: `${name}-${stamp}`,
    email: `${name}-${stamp}@example.com`,
    name,
    emailVerified: true,
  };
  const agent = h.agent();
  await h.signIn(agent);
  const user = await h.prisma.user.findUniqueOrThrow({ where: { email: h.google.claims.email } });
  const row = await h.prisma.dealer.create({
    data: {
      slug: `domain-${name}-${stamp}`,
      brandName: `${name} Motors`,
      legalName: `${name} ${stamp}`,
      status: 'ACTIVE',
      approvedAt: new Date(),
      members: { create: { userId: user.id, role: 'OWNER', permissions: [] } },
    },
  });
  await agent
    .post('/v1/dealer/storefront')
    .send({ subdomain: `${name}-${stamp}`, theme: 'LIGHT' })
    .expect(201);
  await agent.put('/v1/dealer/storefront/enabled').send({ enabled: true }).expect(200);
  return { agent, dealerId: row.id, userId: user.id };
}
const refresh = () => owner.post(`/v1/dealer/storefront/domains/${domainId}/refresh`);
const publicGet = (hostname: string) =>
  h
    .agent()
    .get('/v1/storefront/site')
    .set('x-dd-storefront-host', hostname)
    .set('x-dd-storefront-secret', SECRET);

beforeAll(async () => {
  h = await createAuthHarness(
    createFakeGoogle(),
    createRecordingMailer(),
    {
      STOREFRONT_ENABLED: true,
      STOREFRONT_DEFAULT_DOMAIN_READY: true,
      STOREFRONT_SERVICE_SECRET: SECRET,
    },
    provider,
  );
  const a = await dealer('domain-alpha');
  const b = await dealer('domain-beta');
  owner = a.agent;
  other = b.agent;
  dealerId = a.dealerId;
  userId = a.userId;
});
afterAll(async () => {
  await h.close();
});

describe('custom domains through the real authenticated API and mock provider', () => {
  it('reserves once with fresh ownership instructions and no provider activation', async () => {
    const requests = await Promise.all([
      owner.post('/v1/dealer/storefront/domains').send({ hostname: host }),
      owner.post('/v1/dealer/storefront/domains').send({ hostname: host.toUpperCase() }),
    ]);
    expect(requests.map((row) => row.status)).toEqual([201, 201]);
    const domain = requests[0]?.body.storefront.domains.find(
      (row: { hostname: string }) => row.hostname === host,
    ) as {
      id: string;
      status: string;
      instructions: { type: string; name: string; value: string }[];
    };
    domainId = domain.id;
    originalProof = domain.instructions[0]!.value;
    expect(domain.status).toBe('VERIFICATION_REQUIRED');
    expect(domain.instructions[0]).toMatchObject({ type: 'TXT', name: `_dealers-drive.${host}` });
    expect(provider.attach).not.toHaveBeenCalled();
    await publicGet(host).expect(404);
  });
  it('refuses collisions, platform hostnames, mass assignment and domain IDOR', async () => {
    await other.post('/v1/dealer/storefront/domains').send({ hostname: host }).expect(409);
    for (const hostname of [
      'api.dealers-drive.com',
      'dealers-drive.com',
      'www.vercel.app',
      '*.example.com',
      '127.0.0.1',
      'www.example.com:443',
    ])
      await owner
        .post('/v1/dealer/storefront/domains')
        .send({ hostname })
        .expect(hostname.includes('dealers-drive') || hostname.includes('vercel') ? 422 : 400);
    await owner
      .post('/v1/dealer/storefront/domains')
      .send({ hostname: host, verified: true })
      .expect(400);
    await other.post(`/v1/dealer/storefront/domains/${domainId}/refresh`).expect(404);
    await other.put(`/v1/dealer/storefront/domains/${domainId}/primary`).expect(404);
    await other.delete(`/v1/dealer/storefront/domains/${domainId}`).expect(404);
    await h.agent().post(`/v1/dealer/storefront/domains/${domainId}/refresh`).expect(401);
  });
  it('never contacts attachment until tenant TXT ownership is proved', async () => {
    await refresh().expect(200);
    expect(provider.attach).not.toHaveBeenCalled();
    expect(provider.ownership).toHaveBeenCalledWith(host, originalProof);
    await owner.put(`/v1/dealer/storefront/domains/${domainId}/primary`).expect(422);
  });
  it('reports actual provider records and certificate-pending state', async () => {
    vi.mocked(provider.ownership).mockResolvedValue(true);
    const res = await refresh().expect(200);
    const domain = res.body.storefront.domains.find(
      (row: { id: string }) => row.id === domainId,
    ) as { status: string; instructions: { value: string }[] };
    expect(domain.status).toBe('VERIFICATION_REQUIRED');
    expect(domain.instructions.map((record) => record.value)).toContain(
      'provider-derived.example.net',
    );
    expect(provider.attach).toHaveBeenCalledTimes(1);
    await refresh().expect(200);
    expect(provider.attach).toHaveBeenCalledTimes(1);
    await publicGet(host).expect(404);
  });
  it('activates only with ownership, provider configuration and valid TLS, then sets primary atomically', async () => {
    vi.mocked(provider.inspect).mockResolvedValue({
      ...inspection,
      verified: true,
      configured: true,
      certificateReady: false,
    });
    await refresh().expect(200);
    await publicGet(host).expect(404);
    vi.mocked(provider.inspect).mockResolvedValue({
      ...inspection,
      verified: true,
      configured: true,
      certificateReady: true,
    });
    await refresh().expect(200);
    await owner.put(`/v1/dealer/storefront/domains/${domainId}/primary`).expect(200);
    expect((await publicGet(host).expect(200)).body.primaryHostname).toBe(host);
    expect(
      (await publicGet(`domain-alpha-${stamp}.dealers-drive.com`).expect(200)).body.primaryHostname,
    ).toBe(host);
    const domain = await h.prisma.storefrontDomain.findUniqueOrThrow({ where: { id: domainId } });
    expect(domain.providerAttachedAt).not.toBeNull();
  });
  it('revokes a primary when ownership is lost and safely falls back to the default host', async () => {
    vi.mocked(provider.ownership).mockResolvedValue(false);
    await refresh().expect(200);
    await publicGet(host).expect(404);
    expect(
      (await publicGet(`domain-alpha-${stamp}.dealers-drive.com`).expect(200)).body.primaryHostname,
    ).toBe(`domain-alpha-${stamp}.dealers-drive.com`);
    expect(
      (await h.prisma.storefrontDomain.findUniqueOrThrow({ where: { id: domainId } }))
        .ownershipVerifiedAt,
    ).toBeNull();
  });
  it('persists truthful failure, retries verification and never takes over an existing deployment', async () => {
    vi.mocked(provider.ownership).mockResolvedValue(true);
    vi.mocked(provider.inspect).mockRejectedValueOnce(new Error('provider unavailable'));
    const failed = await refresh().expect(200);
    expect(
      failed.body.storefront.domains.find((row: { id: string }) => row.id === domainId).status,
    ).toBe('FAILED');
    await publicGet(host).expect(404);
    await refresh().expect(200);
    await publicGet(host).expect(200);
    const collision = `existing-${stamp}.example.com`;
    const added = await owner
      .post('/v1/dealer/storefront/domains')
      .send({ hostname: collision })
      .expect(201);
    const id = added.body.storefront.domains.find(
      (row: { hostname: string }) => row.hostname === collision,
    ).id as string;
    vi.mocked(provider.attach).mockRejectedValueOnce(
      new ConflictError('DOMAIN_EXISTING_DEPLOYMENT', 'Already attached'),
    );
    const conflict = await owner.post(`/v1/dealer/storefront/domains/${id}/refresh`).expect(200);
    expect(
      conflict.body.storefront.domains.find((row: { id: string }) => row.id === id),
    ).toMatchObject({ status: 'FAILED', certificateReady: false });
    await publicGet(collision).expect(404);
  });
  it('retains removal-pending on provider outage, denies access and retries safely', async () => {
    await owner.put(`/v1/dealer/storefront/domains/${domainId}/primary`).expect(200);
    vi.mocked(provider.remove).mockRejectedValueOnce(new Error('provider timeout'));
    const res = await owner.delete(`/v1/dealer/storefront/domains/${domainId}`).expect(200);
    expect(
      res.body.storefront.domains.find((row: { id: string }) => row.id === domainId).status,
    ).toBe('REMOVAL_PENDING');
    await publicGet(host).expect(404);
    await owner.delete(`/v1/dealer/storefront/domains/${domainId}`).expect(200);
    await owner.delete(`/v1/dealer/storefront/domains/${domainId}`).expect(200);
    await other.post('/v1/dealer/storefront/domains').send({ hostname: host }).expect(409);
    const defaultDomain = await h.prisma.storefrontDomain.findFirstOrThrow({
      where: { storefront: { dealerId }, kind: 'DEFAULT' },
    });
    await owner.delete(`/v1/dealer/storefront/domains/${defaultDomain.id}`).expect(422);
  });
  it('requires a fresh proof on re-add and does not activate a removed ownership generation', async () => {
    const res = await owner
      .post('/v1/dealer/storefront/domains')
      .send({ hostname: host })
      .expect(201);
    const domain = res.body.storefront.domains.find(
      (row: { id: string }) => row.id === domainId,
    ) as { instructions: { value: string }[] };
    expect(domain.instructions[0]!.value).not.toBe(originalProof);
    await publicGet(host).expect(404);
    const row = await h.prisma.storefrontDomain.findUniqueOrThrow({ where: { id: domainId } });
    expect(row).toMatchObject({
      providerAttachedAt: null,
      ownershipVerifiedAt: null,
      verifiedAt: null,
    });
  });
  it('restricts managers and staff and keeps publications tenant scoped', async () => {
    for (const role of ['MANAGER', 'STAFF'] as const) {
      h.google.claims = {
        subject: `${role}-${stamp}`,
        email: `${role}-${stamp}@example.com`,
        name: role,
        emailVerified: true,
      };
      const agent = h.agent();
      await h.signIn(agent);
      const user = await h.prisma.user.findUniqueOrThrow({
        where: { email: h.google.claims.email },
      });
      await h.prisma.dealerMember.create({
        data: { dealerId, userId: user.id, role, permissions: [] },
      });
      await agent
        .post('/v1/dealer/storefront/domains')
        .send({ hostname: `role-${stamp}.example.com` })
        .expect(403);
      await agent.post(`/v1/dealer/storefront/domains/${domainId}/refresh`).expect(403);
      await agent.put(`/v1/dealer/storefront/domains/${domainId}/primary`).expect(403);
      await agent.delete(`/v1/dealer/storefront/domains/${domainId}`).expect(403);
      await agent.get('/v1/dealer/storefront/publication').expect(role === 'MANAGER' ? 200 : 403);
    }
    const publications = await owner.get('/v1/dealer/storefront/publication').expect(200);
    expect(publications.body.page.limit).toBe(24);
  });
  it('bounds pending reservations and provider refresh jobs', async () => {
    await owner
      .post('/v1/dealer/storefront/domains')
      .send({ hostname: `third-${stamp}.example.com` })
      .expect(201);
    await owner
      .post('/v1/dealer/storefront/domains')
      .send({ hostname: `fourth-${stamp}.example.com` })
      .expect(422);
    vi.mocked(provider.attach).mockResolvedValue(undefined);
    await refresh().expect(200);
    await h.prisma.storefrontDomain.update({
      where: { id: domainId },
      data: { checkedAt: new Date(0) },
    });
    await publicGet(host).expect(404);
    const service = createStorefrontService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
      config: {
        ...env,
        STOREFRONT_ENABLED: true,
        STOREFRONT_SERVICE_SECRET: SECRET,
        STOREFRONT_DEFAULT_DOMAIN_READY: true,
      },
    });
    const domains = createStorefrontDomains(
      h.prisma,
      createAuditService(h.prisma),
      service,
      provider,
    );
    await domains.sweep();
    await publicGet(host).expect(200);
    await h.prisma.dealerMember.updateMany({
      where: { dealerId, userId },
      data: { status: 'REMOVED' },
    });
    await refresh().expect(401);
  });
});
