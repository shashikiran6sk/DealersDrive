import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type request from 'supertest';
import { env } from '../src/config/env.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';
import { createAdminSupportService } from '../src/modules/support/support.admin.service.js';
import { createAuditService } from '../src/platform/audit/audit.service.js';
let h: AuthHarness;
let customer: request.Agent;
let other: request.Agent;
let admin: request.Agent;
beforeAll(async () => {
  h = await createAuthHarness();
  async function person(phone: string) {
    const agent = h.agent();
    const signed = await agent
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${randomUUID()}` })
      .expect(200);
    const response = await agent
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: signed.body.signUpToken, fullName: 'Synthetic Quota Customer' })
      .expect(201);
    return { agent, id: String(response.body.customer.id) };
  }
  const first = await person('9000008181');
  customer = first.agent;
  other = (await person('9000008282')).agent;
  h.google.claims = {
    subject: 'ticket-quota-admin',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Synthetic Quota Admin',
  };
  admin = h.agent();
  await h.signInAdmin(admin);
});
afterAll(async () => {
  await h.close();
});
async function opened() {
  return (
    await customer
      .post('/v1/support/tickets')
      .send({
        category: 'GENERAL_QUESTION',
        subject: 'Synthetic ticket quota',
        description: 'Synthetic original request stored separately from reply messages.',
      })
      .expect(201)
  ).body as { id: string; remainingMessages: number; canReply: boolean };
}
function reply(
  id: string,
  message = 'Synthetic customer reply',
  clientMessageId?: string,
  agent = customer,
) {
  return agent
    .post(`/v1/support/tickets/${id}/messages`)
    .send({ message, ...(clientMessageId ? { clientMessageId } : {}) });
}
function support(id: string, clientMessageId?: string) {
  return admin
    .post(`/v1/admin/support/tickets/${id}/messages`)
    .send({ message: 'Synthetic support reply', ...(clientMessageId ? { clientMessageId } : {}) });
}
async function fill(id: string, count = 5) {
  for (let i = 0; i < count; i += 1)
    await reply(id, `Synthetic message ${i}`, randomUUID()).expect(201);
}
async function detail(id: string) {
  return (await customer.get(`/v1/support/tickets/${id}`).expect(200)).body as {
    remainingMessages: number;
    canReply: boolean;
    messages: unknown[];
    status: string;
  };
}
describe('five consecutive unanswered ticket messages', () => {
  it.each([
    'missing_member',
    'disabled_member',
    'suspended_seat',
    'lost_permission',
    'deleted_user',
  ] as const)('refuses quota reset for %s at the persistence boundary', async (kind) => {
    const t = await opened();
    await fill(t.id);
    const actor = await h.prisma.user.create({
      data: {
        email: `synthetic-quota-${kind}@example.test`,
        adminMember: { create: { role: 'SUPPORT', status: 'ACTIVE', source: 'INVITED' } },
        roles: { create: { role: 'ADMIN', status: 'ACTIVE' } },
      },
    });
    if (kind === 'missing_member')
      await h.prisma.adminMember.delete({ where: { userId: actor.id } });
    else if (kind === 'disabled_member')
      await h.prisma.adminMember.update({
        where: { userId: actor.id },
        data: { status: 'DISABLED' },
      });
    else if (kind === 'suspended_seat')
      await h.prisma.userRole.updateMany({
        where: { userId: actor.id },
        data: { status: 'SUSPENDED' },
      });
    else if (kind === 'lost_permission')
      await h.prisma.adminMember.update({
        where: { userId: actor.id },
        data: { role: 'SALES_REP' },
      });
    else await h.prisma.user.delete({ where: { id: actor.id } });
    const service = createAdminSupportService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
    });
    await expect(
      service.reply(
        {
          kind: 'ADMIN',
          userId: actor.id,
          email: actor.email ?? '',
          adminRole: 'SUPPORT',
          permissions: ['admin:console', 'admin:support:manage'],
        },
        t.id,
        { message: 'Unauthorized support reset' },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect((await detail(t.id)).remainingMessages).toBe(0);
  });
  it('rejects a different support author reusing an earlier reply UUID without resetting quota', async () => {
    const t = await opened(),
      key = randomUUID();
    await support(t.id, key).expect(201);
    await fill(t.id);
    const actor = await h.prisma.user.create({
      data: {
        email: 'synthetic-quota-second-admin@example.test',
        fullName: 'Synthetic Second Admin',
        adminMember: { create: { role: 'SUPPORT', status: 'ACTIVE', source: 'INVITED' } },
      },
      include: { adminMember: true },
    });
    const service = createAdminSupportService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
    });
    await expect(
      service.reply(
        {
          kind: 'ADMIN',
          userId: actor.id,
          email: actor.email ?? '',
          adminRole: 'SUPPORT',
          permissions: ['admin:console', 'admin:support:manage'],
        },
        t.id,
        { message: 'Synthetic support reply', clientMessageId: key },
      ),
    ).rejects.toMatchObject({ code: 'SUPPORT_MESSAGE_RETRY_CONFLICT' });
    expect((await detail(t.id)).remainingMessages).toBe(0);
  });
  it('rechecks authorization inside the transaction before a stale admin principal can reset quota', async () => {
    const t = await opened();
    await fill(t.id);
    const user = await h.prisma.user.findUniqueOrThrow({
      where: { email: env.adminAllowlist[0] ?? '' },
      include: { adminMember: true },
    });
    const service = createAdminSupportService({
      prisma: h.prisma,
      audit: createAuditService(h.prisma),
    });
    const principal = {
      kind: 'ADMIN',
      userId: user.id,
      memberId: user.adminMember?.id,
      email: user.email ?? '',
      adminRole: 'SUPER_ADMIN',
      permissions: ['admin:console', 'admin:support:manage'],
    } as const;
    await h.prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    try {
      await expect(
        service.reply(principal, t.id, { message: 'Stale unauthorized reply' }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await h.prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    }
    expect((await detail(t.id)).remainingMessages).toBe(0);
    expect(
      await h.prisma.supportTicketMessage.count({
        where: { ticketId: t.id, authorType: 'SUPPORT' },
      }),
    ).toBe(0);
  });
  it('serializes a new customer reply with support reset without losing either message', async () => {
    const t = await opened();
    await fill(t.id, 4);
    const results = await Promise.all([
      reply(t.id, 'Concurrent customer', randomUUID()),
      support(t.id, randomUUID()),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect([0, 1]).toContain(row.unansweredCustomerMessages);
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: t.id } })).toBe(6);
  });
  it('starts with five slots; description is not a message and each successful persisted reply consumes one', async () => {
    const t = await opened();
    expect(t.remainingMessages).toBe(5);
    expect(t.canReply).toBe(true);
    for (let i = 1; i <= 5; i += 1) {
      await reply(t.id, `Synthetic message ${i}`).expect(201);
      const d = await detail(t.id);
      expect(d.remainingMessages).toBe(5 - i);
      expect(d.messages).toHaveLength(i);
      expect(d.canReply).toBe(i < 5);
    }
    const refused = await reply(t.id).expect(409);
    expect(refused.body.code).toBe('SUPPORT_MESSAGE_LIMIT_REACHED');
    expect(refused.body.detail).toBe(
      "You've sent five messages. Please wait for our support team to reply before sending more.",
    );
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: t.id } })).toBe(5);
  });
  it('resets exactly five slots on each new support reply', async () => {
    const t = await opened();
    for (let reset = 0; reset < 2; reset += 1) {
      await fill(t.id);
      await support(t.id, randomUUID()).expect(201);
      expect((await detail(t.id)).remainingMessages).toBe(5);
    }
    await fill(t.id);
    await reply(t.id).expect(409);
  });
  it('does not reset on an internal note or status change', async () => {
    const t = await opened();
    await fill(t.id);
    await admin
      .post(`/v1/admin/support/tickets/${t.id}/notes`)
      .send({ note: 'Synthetic internal note' })
      .expect(201);
    await admin
      .patch(`/v1/admin/support/tickets/${t.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect((await detail(t.id)).remainingMessages).toBe(0);
    await reply(t.id).expect(409);
  });
  it('keeps allowances independent for each ticket', async () => {
    const a = await opened(),
      b = await opened();
    await fill(a.id);
    await reply(b.id).expect(201);
    expect((await detail(a.id)).remainingMessages).toBe(0);
    expect((await detail(b.id)).remainingMessages).toBe(4);
  });
  it('rejects forged author, attachments and invalid empty submissions without consuming quota', async () => {
    const t = await opened();
    for (const body of [
      { message: '' },
      { message: ' ' },
      { message: 'forged', authorType: 'SUPPORT' },
      { attachments: ['forged-upload'] },
      { message: 'attachment-only', attachments: ['forged-upload'] },
    ])
      await customer.post(`/v1/support/tickets/${t.id}/messages`).send(body).expect(400);
    expect((await detail(t.id)).remainingMessages).toBe(5);
  });
  it('accepts exactly one of two simultaneous submissions with one slot remaining', async () => {
    const t = await opened();
    await fill(t.id, 4);
    const results = await Promise.all([
      reply(t.id, 'Concurrent one', randomUUID()),
      reply(t.id, 'Concurrent two', randomUUID()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await detail(t.id)).remainingMessages).toBe(0);
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: t.id } })).toBe(5);
  });
  it('treats concurrent duplicate retries as one persisted message', async () => {
    const t = await opened();
    const id = randomUUID();
    const results = await Promise.all([
      reply(t.id, 'Same retry', id),
      reply(t.id, 'Same retry', id),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect((await detail(t.id)).remainingMessages).toBe(4);
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: t.id } })).toBe(1);
  });
  it('accepts the exact retry after the fifth message without increasing the counter', async () => {
    const t = await opened();
    await fill(t.id, 4);
    const key = randomUUID();
    await reply(t.id, 'Final slot', key).expect(201);
    const before = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    await reply(t.id, 'Final slot', key).expect(201);
    const after = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.unansweredCustomerMessages).toBe(5);
  });
  it('refuses key reuse with changed text without changing messages or quota', async () => {
    const t = await opened(),
      key = randomUUID();
    await reply(t.id, 'Original reply', key).expect(201);
    const r = await reply(t.id, 'Changed reply', key).expect(409);
    expect(r.body.code).toBe('SUPPORT_MESSAGE_RETRY_CONFLICT');
    expect((await detail(t.id)).remainingMessages).toBe(4);
  });
  it('does not reset quota when a previously persisted admin reply is retried', async () => {
    const t = await opened(),
      key = randomUUID();
    await support(t.id, key).expect(201);
    await fill(t.id);
    await support(t.id, key).expect(201);
    expect((await detail(t.id)).remainingMessages).toBe(0);
    await reply(t.id).expect(409);
  });
  it('permits the same client UUID independently on another ticket and another author scope', async () => {
    const a = await opened(),
      b = await opened(),
      key = randomUUID();
    await reply(a.id, 'Customer reply', key).expect(201);
    await reply(b.id, 'Customer reply', key).expect(201);
    await support(a.id, key).expect(201);
    expect((await detail(a.id)).remainingMessages).toBe(5);
    expect((await detail(b.id)).remainingMessages).toBe(4);
  });
  it('checks ownership before accepting a replay and does not expose another customer quota', async () => {
    const t = await opened(),
      key = randomUUID();
    await reply(t.id, 'Owner reply', key).expect(201);
    await reply(t.id, 'Owner reply', key, other).expect(404);
    await other.get(`/v1/support/tickets/${t.id}`).expect(404);
    expect((await detail(t.id)).remainingMessages).toBe(4);
  });
  it('rejects unauthorized admin replies without resetting allowance', async () => {
    const t = await opened();
    await fill(t.id);
    await customer
      .post(`/v1/admin/support/tickets/${t.id}/messages`)
      .send({ message: 'forged admin' })
      .expect(401);
    expect((await detail(t.id)).remainingMessages).toBe(0);
  });
  it('does not let resolving or reopening bypass the quota, but a genuine reply allows reopening', async () => {
    const t = await opened();
    await fill(t.id);
    await admin.patch(`/v1/admin/support/tickets/${t.id}`).send({ status: 'RESOLVED' }).expect(200);
    await reply(t.id).expect(409);
    expect((await detail(t.id)).status).toBe('RESOLVED');
    await support(t.id).expect(201);
    await reply(t.id).expect(201);
    expect((await detail(t.id)).status).toBe('OPEN');
    expect((await detail(t.id)).remainingMessages).toBe(4);
  });
  it('preserves closed restrictions even with allowance, and an old retry never reopens a closed ticket', async () => {
    const t = await opened(),
      key = randomUUID();
    await reply(t.id, 'Before close', key).expect(201);
    await admin.patch(`/v1/admin/support/tickets/${t.id}`).send({ status: 'CLOSED' }).expect(200);
    await reply(t.id).expect(409);
    await support(t.id).expect(409);
    await reply(t.id, 'Before close', key).expect(201);
    expect((await detail(t.id)).status).toBe('CLOSED');
    expect((await detail(t.id)).canReply).toBe(false);
  });
  it('enforces quota bounds directly in the database', async () => {
    const t = await opened();
    await expect(
      h.prisma.supportTicket.update({
        where: { id: t.id },
        data: { unansweredCustomerMessages: 6 },
      }),
    ).rejects.toThrow(/support_ticket_unanswered_quota/);
    await expect(
      h.prisma.supportTicket.update({
        where: { id: t.id },
        data: { unansweredCustomerMessages: -1 },
      }),
    ).rejects.toThrow(/support_ticket_unanswered_quota/);
    expect((await detail(t.id)).remainingMessages).toBe(5);
  });
});
