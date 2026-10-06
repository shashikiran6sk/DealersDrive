import { randomBytes, randomUUID } from 'node:crypto';

import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { buildOpenApiDocument } from '../src/docs/openapi.js';
import { hashToken } from '../src/modules/auth/session.service.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * Admin Members — who may enter which console, and as what.
 *
 * Google proves who signed in; the `admin_members` row decides whether they are
 * an operator at all, with which role, and whether that is still true. Every
 * case here runs the real cookie path, because the guarantees are the guards'.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let counter = 0;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'rbac-super-admin',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Dealers-Drive Operations',
  };
  superAdmin = h.agent();
  await h.signInAdmin(superAdmin);
});

afterAll(async () => {
  await h.close();
});

function nextEmail(label: string): string {
  counter += 1;
  return `${label}.${String(counter)}.${Date.now().toString(36)}@dealers-drive.test`;
}

async function signInAs(email: string, emailVerified = true) {
  counter += 1;
  h.google.claims = {
    subject: `rbac-sub-${String(counter)}`,
    email,
    emailVerified,
    name: 'Team Member',
  };
  const agent = h.agent();
  const result = await h.signInAdmin(agent);
  return { agent, location: result.location.replace(env.WEB_BASE_URL, '') };
}

async function invite(email: string, adminRole: string) {
  await superAdmin.post('/v1/admin/access').send({ email, adminRole }).expect(201);
  return h.prisma.adminMember.findFirstOrThrow({ where: { user: { email } } });
}

function adminOperations(): { method: (typeof HTTP_METHODS)[number]; path: string }[] {
  const document = buildOpenApiDocument();
  const operations: { method: (typeof HTTP_METHODS)[number]; path: string }[] = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (!path.startsWith('/v1/admin')) continue;
    for (const method of HTTP_METHODS) {
      if (item && method in item) {
        operations.push({ method, path: path.replace(/\{[^}]+\}/g, randomUUID()) });
      }
    }
  }
  return operations;
}

describe('the bootstrap Super admin', () => {
  it('is an ACTIVE BOOTSTRAP member, admitted by the allow-list', async () => {
    const member = await h.prisma.adminMember.findFirstOrThrow({
      where: { user: { email: env.adminAllowlist[0] ?? '' } },
    });
    expect(member).toMatchObject({ role: 'SUPER_ADMIN', status: 'ACTIVE', source: 'BOOTSTRAP' });
    expect(member.lastLoginAt).toBeInstanceOf(Date);

    const overview = await superAdmin.get('/v1/admin/metrics/overview').expect(200);
    expect(overview.body.operator.adminRole).toBe('SUPER_ADMIN');
  });

  it('is refused once the address is no longer on the allow-list', async () => {
    const email = nextEmail('former.bootstrap');
    const user = await h.prisma.user.create({
      data: {
        email,
        adminMember: { create: { role: 'SUPER_ADMIN', status: 'ACTIVE', source: 'BOOTSTRAP' } },
      },
    });
    const token = randomBytes(32).toString('base64url');
    await h.prisma.session.create({
      data: {
        userId: user.id,
        scope: 'ADMIN',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await h
      .agent()
      .get('/v1/admin/metrics/overview')
      .set('Cookie', `dd_session=${token}`)
      .expect(401);
    const refused = await signInAs(email);
    expect(refused.location).toContain('error=not_authorised');
  });
});

describe('a Sales Representative', () => {
  let sales: request.Agent;
  let salesEmail: string;

  beforeAll(async () => {
    salesEmail = nextEmail('sales.rep');
    const invited = await invite(salesEmail, 'SALES_REP');
    expect(invited).toMatchObject({ role: 'SALES_REP', status: 'INVITED', source: 'INVITED' });

    const signedIn = await signInAs(salesEmail);
    sales = signedIn.agent;
    expect(signedIn.location).toBe('/sales');
  });

  it('is activated by their first sign-in, and that is audited', async () => {
    const member = await h.prisma.adminMember.findFirstOrThrow({
      where: { user: { email: salesEmail } },
    });
    expect(member.status).toBe('ACTIVE');
    expect(member.activatedAt).toBeInstanceOf(Date);

    const activated = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin_member.activated', entityId: member.id },
    });
    expect(activated.actorId).toBe(member.userId);
  });

  it('is refused every admin console route, by API, with a 403', async () => {
    const operations = adminOperations();
    expect(operations.length).toBeGreaterThan(30);

    for (const { method, path } of operations) {
      const res = await sales[method](path).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
      expect(res.body.code, `${method.toUpperCase()} ${path}`).toBe('ADMIN_CONSOLE_FORBIDDEN');
    }
  });

  it('cannot approve, reject, suspend or reinstate a dealership, or touch configuration', async () => {
    const dealer = await h.prisma.dealer.findFirstOrThrow({ select: { id: true, status: true } });

    for (const action of ['approve', 'reject', 'suspend', 'reinstate', 'request-changes']) {
      await sales
        .post(`/v1/admin/dealers/${dealer.id}/${action}`)
        .send({ reason: 'Trying it on.' })
        .expect(403);
    }
    await sales.put('/v1/admin/config/support.email').send({ value: 'x@y.in' }).expect(403);
    await sales
      .post('/v1/admin/access')
      .send({ email: 'x@y.in', adminRole: 'SUPER_ADMIN' })
      .expect(403);

    const after = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.id } });
    expect(after.status).toBe(dealer.status);
  });

  it('cannot read a dealership’s private documents through the console', async () => {
    const dealer = await h.prisma.dealer.findFirstOrThrow({ select: { id: true } });
    const res = await sales.get(`/v1/admin/dealers/${dealer.id}`).expect(403);
    expect(JSON.stringify(res.body)).not.toContain('signedUrl');
  });

  it('is not offered as a support assignee', async () => {
    const queue = await superAdmin.get('/v1/admin/support/tickets').expect(200);
    const assignees = JSON.stringify(queue.body);
    expect(assignees).not.toContain(salesEmail);
  });

  it('gains the console on the very next request when re-roled, without signing in again', async () => {
    const email = nextEmail('promoted');
    await invite(email, 'SALES_REP');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/metrics/overview').expect(403);

    await invite(email, 'SUPPORT');
    const overview = await agent.get('/v1/admin/metrics/overview').expect(200);
    expect(overview.body.operator.adminRole).toBe('SUPPORT');
    await agent
      .post('/v1/admin/access')
      .send({ email: 'x@y.in', adminRole: 'SUPPORT' })
      .expect(403);
  });
});

describe('disabling a member', () => {
  it('ends their console session at once, and refuses their next sign-in', async () => {
    const email = nextEmail('leaver');
    const member = await invite(email, 'MODERATOR');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/metrics/overview').expect(200);

    await superAdmin.delete(`/v1/admin/access/${member.userId}`).expect(204);

    await agent.get('/v1/admin/metrics/overview').expect(401);
    const again = await signInAs(email);
    expect(again.location).toContain('error=not_authorised');

    const disabled = await h.prisma.adminMember.findUniqueOrThrow({ where: { id: member.id } });
    expect(disabled).toMatchObject({ status: 'DISABLED' });
    const user = await h.prisma.user.findUniqueOrThrow({
      where: { id: member.userId },
      include: { roles: true },
    });
    expect(user.isPlatformAdmin).toBe(false);
    expect(user.roles.find((seat) => seat.role === 'ADMIN')?.status).toBe('SUSPENDED');

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin_member.disabled', entityId: member.id },
    });
    expect(audit.after).toMatchObject({ status: 'DISABLED', sessionsRevoked: 1 });
  });

  it('can be undone by inviting the address again', async () => {
    const email = nextEmail('returner');
    const member = await invite(email, 'SUPPORT');
    await signInAs(email);
    await superAdmin.delete(`/v1/admin/access/${member.userId}`).expect(204);

    await invite(email, 'SUPPORT');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/metrics/overview').expect(200);
  });
});

describe('who Google cannot make an operator', () => {
  it('refuses an address that is neither allow-listed nor invited', async () => {
    const refused = await signInAs(nextEmail('stranger'));
    expect(refused.location).toContain('error=not_authorised');
    expect(
      await h.prisma.adminMember.count({ where: { user: { email: { contains: 'stranger' } } } }),
    ).toBe(0);
  });

  it('refuses an invited address whose Google email is not verified', async () => {
    const email = nextEmail('unverified');
    await invite(email, 'SUPPORT');
    const refused = await signInAs(email, false);
    expect(refused.location).toContain('error=not_authorised');

    const member = await h.prisma.adminMember.findFirstOrThrow({ where: { user: { email } } });
    expect(member.status).toBe('INVITED');
  });

  it('does not let a dealer session into either console', async () => {
    const dealer = h.agent();
    h.google.claims = {
      subject: 'rbac-dealer',
      email: nextEmail('dealer'),
      emailVerified: true,
      name: 'Dealer',
    };
    await h.signIn(dealer);
    await dealer.get('/v1/admin/metrics/overview').expect(401);
  });
});
