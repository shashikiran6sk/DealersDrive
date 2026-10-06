import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * Admin Member management — the Super admin's screen.
 *
 * Invite, re-role, disable and re-activate, each audited with the member who
 * acted, and each refused for the cases that would lock the platform out of
 * its own console: yourself, an allow-listed address, the last Super admin.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let counter = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'members-super-admin',
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

async function signInAs(email: string) {
  counter += 1;
  h.google.claims = { subject: `members-sub-${String(counter)}`, email, emailVerified: true };
  const agent = h.agent();
  const result = await h.signInAdmin(agent);
  return { agent, location: result.location.replace(env.WEB_BASE_URL, '') };
}

async function invite(role: string, label = role.toLowerCase()) {
  const email = nextEmail(label);
  const res = await superAdmin
    .post('/v1/admin/members')
    .send({ email, name: `${label} person`, role })
    .expect(201);
  return { email, member: res.body as { id: string; userId: string; status: string } };
}

describe('inviting', () => {
  it('creates an INVITED member that the first sign-in activates', async () => {
    const { email, member } = await invite('MODERATOR', 'ops');
    expect(member).toMatchObject({
      status: 'INVITED',
      statusLabel: 'Invited',
      role: 'MODERATOR',
      roleLabel: 'Operations',
      source: 'INVITED',
      lastLoginLabel: 'Never',
      lockedReason: null,
    });

    await signInAs(email);
    const list = await superAdmin.get('/v1/admin/members').expect(200);
    const row = list.body.data.find((entry: { id: string }) => entry.id === member.id);
    expect(row).toMatchObject({ status: 'ACTIVE', invitedByEmail: env.adminAllowlist[0] });
    expect(row.activatedAt).not.toBeNull();
  });

  it('refuses an address that is already a member', async () => {
    const { email } = await invite('SUPPORT');
    const refused = await superAdmin
      .post('/v1/admin/members')
      .send({ email, role: 'SUPER_ADMIN' })
      .expect(409);
    expect(refused.body.code).toBe('ADMIN_MEMBER_EXISTS');
  });

  it('refuses unknown fields and a missing role, by name', async () => {
    const res = await superAdmin
      .post('/v1/admin/members')
      .send({ email: nextEmail('x'), role: 'SALES_REP', isPlatformAdmin: true })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('isPlatformAdmin');
    await superAdmin
      .post('/v1/admin/members')
      .send({ email: nextEmail('x') })
      .expect(400);
  });

  it('records the inviter in the audit trail', async () => {
    const { member } = await invite('SALES_REP', 'sales');
    const history = await superAdmin.get(`/v1/admin/members/${member.id}/history`).expect(200);
    expect(history.body.history[0]).toMatchObject({
      action: 'admin_member.invited',
      label: 'Invited',
      actorEmail: env.adminAllowlist[0],
      detail: 'as Sales representative',
    });
  });
});

describe('changing a role', () => {
  it('applies on the member’s next request, without signing in again', async () => {
    const { email, member } = await invite('SALES_REP', 'promote');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/metrics/overview').expect(403);

    const changed = await superAdmin
      .patch(`/v1/admin/members/${member.id}`)
      .send({ role: 'MODERATOR' })
      .expect(200);
    expect(changed.body).toMatchObject({ role: 'MODERATOR' });

    const overview = await agent.get('/v1/admin/metrics/overview').expect(200);
    expect(overview.body.operator).toMatchObject({
      adminRole: 'MODERATOR',
      roleLabel: 'Operations',
    });
    expect(overview.body.operator.permissions).toContain('admin:listing:moderate');

    const history = await superAdmin.get(`/v1/admin/members/${member.id}/history`).expect(200);
    expect(
      history.body.history.find(
        (entry: { action: string }) => entry.action === 'admin_member.role_changed',
      ),
    ).toMatchObject({ detail: 'Sales representative → Operations' });
  });

  it('demotes on the next request too', async () => {
    const { email, member } = await invite('SUPER_ADMIN', 'demote');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/members').expect(200);

    await superAdmin.patch(`/v1/admin/members/${member.id}`).send({ role: 'SUPPORT' }).expect(200);
    await agent.get('/v1/admin/members').expect(403);
  });

  it('refuses your own membership and an allow-listed member', async () => {
    const self = await h.prisma.adminMember.findFirstOrThrow({
      where: { user: { email: env.adminAllowlist[0] ?? '' } },
    });
    const refused = await superAdmin
      .patch(`/v1/admin/members/${self.id}`)
      .send({ role: 'SUPPORT' })
      .expect(403);
    expect(refused.body.code).toBe('ADMIN_MEMBER_SELF');

    const { email, member } = await invite('SUPER_ADMIN', 'other.super');
    const { agent: otherSuper } = await signInAs(email);
    const bootstrap = await otherSuper
      .patch(`/v1/admin/members/${self.id}`)
      .send({ role: 'SUPPORT' })
      .expect(409);
    expect(bootstrap.body.code).toBe('ADMIN_MEMBER_BOOTSTRAP');
    await otherSuper
      .post(`/v1/admin/members/${self.id}/disable`)
      .send({ reason: 'Trying to lock the founder out.' })
      .expect(409);
    expect(member.status).toBe('INVITED');
  });

  it('answers 404 for a member that does not exist', async () => {
    await superAdmin
      .patch('/v1/admin/members/00000000-0000-4000-8000-000000000999')
      .send({ role: 'SUPPORT' })
      .expect(404);
  });
});

describe('disabling and re-activating', () => {
  it('revokes their sessions at once, refuses their sign-in, and keeps the reason', async () => {
    const { email, member } = await invite('SALES_REP', 'leaver');
    const { agent } = await signInAs(email);
    await agent.get('/v1/admin/metrics/overview').expect(403);

    const disabled = await superAdmin
      .post(`/v1/admin/members/${member.id}/disable`)
      .send({ reason: 'Left the company.' })
      .expect(200);
    expect(disabled.body).toMatchObject({
      status: 'DISABLED',
      disabledReason: 'Left the company.',
    });

    await agent.get('/v1/admin/metrics/overview').expect(401);
    const again = await signInAs(email);
    expect(again.location).toContain('error=not_authorised');

    await superAdmin
      .post(`/v1/admin/members/${member.id}/disable`)
      .send({ reason: 'Again.' })
      .expect(409);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'admin_member.disabled', entityId: member.id },
    });
    expect(audit.after).toMatchObject({ reason: 'Left the company.', sessionsRevoked: 1 });
  });

  it('re-activates to ACTIVE when they had signed in, INVITED when they had not', async () => {
    const used = await invite('SUPPORT', 'used');
    await signInAs(used.email);
    await superAdmin
      .post(`/v1/admin/members/${used.member.id}/disable`)
      .send({ reason: 'Paused.' })
      .expect(200);
    const back = await superAdmin.post(`/v1/admin/members/${used.member.id}/activate`).expect(200);
    expect(back.body.status).toBe('ACTIVE');
    const { agent } = await signInAs(used.email);
    await agent.get('/v1/admin/metrics/overview').expect(200);

    const unused = await invite('SUPPORT', 'unused');
    await superAdmin
      .post(`/v1/admin/members/${unused.member.id}/disable`)
      .send({ reason: 'Wrong person.' })
      .expect(200);
    const restored = await superAdmin
      .post(`/v1/admin/members/${unused.member.id}/activate`)
      .expect(200);
    expect(restored.body.status).toBe('INVITED');

    await superAdmin.post(`/v1/admin/members/${unused.member.id}/activate`).expect(409);
  });

  it('needs a reason', async () => {
    const { member } = await invite('SUPPORT', 'noreason');
    await superAdmin.post(`/v1/admin/members/${member.id}/disable`).send({}).expect(400);
  });
});

describe('the last Super admin', () => {
  /**
   * Every caller who can manage members is an active Super admin and cannot
   * target themselves, so the guard matters in one place: two Super admins
   * disabling each other at the same moment. The member-management lock puts
   * them in order, and the second finds itself the last one standing.
   */
  it('survives two Super admins disabling each other at once', async () => {
    const bootstrapEmail = env.adminAllowlist[0] ?? '';
    const a = await invite('SUPER_ADMIN', 'super.a');
    const b = await invite('SUPER_ADMIN', 'super.b');
    const { agent: agentA } = await signInAs(a.email);
    const { agent: agentB } = await signInAs(b.email);
    await h.prisma.adminMember.updateMany({
      where: { user: { email: bootstrapEmail } },
      data: { role: 'MODERATOR' },
    });
    const others = await h.prisma.adminMember.findMany({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { notIn: [a.member.id, b.member.id] } },
      select: { id: true },
    });
    await h.prisma.adminMember.updateMany({
      where: { id: { in: others.map((row) => row.id) } },
      data: { status: 'DISABLED' },
    });

    try {
      const [byA, byB] = await Promise.all([
        agentA.post(`/v1/admin/members/${b.member.id}/disable`).send({ reason: 'Race A.' }),
        agentB.post(`/v1/admin/members/${a.member.id}/disable`).send({ reason: 'Race B.' }),
      ]);
      const statuses = [byA.status, byB.status].sort();
      expect(statuses[0]).toBe(200);
      expect([401, 409]).toContain(statuses[1]);

      const left = await h.prisma.adminMember.count({
        where: { id: { in: [a.member.id, b.member.id] }, status: 'ACTIVE' },
      });
      expect(left).toBe(1);
    } finally {
      await h.prisma.adminMember.updateMany({
        where: { user: { email: bootstrapEmail } },
        data: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      });
      await h.prisma.adminMember.updateMany({
        where: { id: { in: others.map((row) => row.id) } },
        data: { status: 'ACTIVE' },
      });
    }
  });
});

describe('who may manage members', () => {
  it('refuses every member route to Operations, Support and Sales', async () => {
    for (const role of ['MODERATOR', 'SUPPORT', 'SALES_REP']) {
      const { email } = await invite(role, `nomanage.${role.toLowerCase()}`);
      const { agent } = await signInAs(email);
      const target = await invite('SUPPORT', 'victim');

      const expected = role === 'SALES_REP' ? 'ADMIN_CONSOLE_FORBIDDEN' : 'FORBIDDEN';
      const calls = [
        agent.get('/v1/admin/members'),
        agent.post('/v1/admin/members').send({ email: nextEmail('z'), role: 'SUPER_ADMIN' }),
        agent.patch(`/v1/admin/members/${target.member.id}`).send({ role: 'SUPER_ADMIN' }),
        agent.post(`/v1/admin/members/${target.member.id}/disable`).send({ reason: 'Nope.' }),
        agent.post(`/v1/admin/members/${target.member.id}/activate`),
        agent.get(`/v1/admin/members/${target.member.id}/history`),
      ];
      for (const call of calls) {
        const res = await call;
        expect(res.status, `${role}`).toBe(403);
        expect(res.body.code, `${role}`).toBe(expected);
      }
    }
  });

  it('filters by status and role, and counts by status', async () => {
    const res = await superAdmin.get('/v1/admin/members?status=INVITED&role=SUPPORT').expect(200);
    expect(
      res.body.data.every(
        (member: { status: string; role: string }) =>
          member.status === 'INVITED' && member.role === 'SUPPORT',
      ),
    ).toBe(true);
    expect(res.body.counts.ALL).toBeGreaterThanOrEqual(res.body.counts.INVITED);
    await superAdmin.get('/v1/admin/members?status=GONE').expect(400);
  });
});
