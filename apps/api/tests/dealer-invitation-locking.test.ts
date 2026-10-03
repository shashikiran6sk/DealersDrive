import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';

let h: AuthHarness;
let fixtures: ReturnType<typeof marketplaceFixtures>;
let sequence = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  fixtures = marketplaceFixtures(h, 'invitation-locking');
});

afterAll(async () => {
  await h.close();
});

async function pendingInvitation() {
  const owner = await fixtures.dealership();
  sequence += 1;
  const phone = `944551${String(1000 + sequence)}`;
  const customer = h.agent();
  const proof = await customer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:invitation-lock-${String(sequence)}`,
    })
    .expect(200);
  const created = await customer
    .post('/v1/auth/sign-up/customer')
    .send({
      signUpToken: proof.body.signUpToken,
      fullName: 'Invitation Race Fixture',
    })
    .expect(201);
  const invited = await owner.agent
    .post('/v1/dealer/team/invitations')
    .send({ phone, role: 'STAFF' })
    .expect(201);
  return {
    owner,
    customer,
    phone,
    userId: String(created.body.customer.id),
    invitationId: String(invited.body.id),
  };
}

async function waitForDealerWaiters(observer: Client, count: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const waiting = await observer.query<{ pid: number }>(`
      SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND state = 'active' AND query LIKE '%SELECT "id" FROM "dealers"%'
    `);
    if (waiting.rows.length >= count) return;
    await pause(20);
  }
  throw new Error(`Expected ${String(count)} observed dealership lock waiters`);
}

// Each request reaches a real lock wait before the next request starts. The
// holder connection guarantees the dealer lock queue order, instead of relying
// on Promise.all scheduling. The observer has its own fresh snapshots.
async function lockDealer(dealerId: string) {
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  await holder.query('SELECT "id" FROM "dealers" WHERE "id"=$1::uuid FOR UPDATE', [dealerId]);
  return { holder, observer };
}

describe('BUG-001 / ADD-RACE-001 — deterministic invitation lock order', () => {
  it.each(['withdrawal', 'acceptance'] as const)(
    'settles %s queued first without a deadlock',
    async (first) => {
      const f = await pendingInvitation();
      const { holder, observer } = await lockDealer(f.owner.dealerId);
      const pending: Promise<unknown>[] = [];
      let held = true;
      try {
        const accept = () =>
          f.customer.post(`/v1/invitations/${f.invitationId}/accept`).then((r) => r);
        const withdraw = () =>
          f.owner.agent.delete(`/v1/dealer/team/invitations/${f.invitationId}`).then((r) => r);
        const firstResponse = first === 'withdrawal' ? withdraw() : accept();
        pending.push(firstResponse);
        await waitForDealerWaiters(observer, 1);
        const secondResponse = first === 'withdrawal' ? accept() : withdraw();
        pending.push(secondResponse);
        await waitForDealerWaiters(observer, 2);
        await holder.query('COMMIT');
        held = false;
        const [one, two] = await Promise.all([firstResponse, secondResponse]);
        const accepted = first === 'withdrawal' ? two : one;
        const revoked = first === 'withdrawal' ? one : two;
        const invitation = await h.prisma.dealerInvitation.findUniqueOrThrow({
          where: { id: f.invitationId },
        });
        const member = await h.prisma.dealerMember.findUnique({
          where: {
            dealerId_userId: { dealerId: f.owner.dealerId, userId: f.userId },
          },
        });
        const joined = await h.prisma.auditLog.count({
          where: {
            dealerId: f.owner.dealerId,
            actorId: f.userId,
            action: 'member.joined',
          },
        });
        const withdrawn = await h.prisma.auditLog.count({
          where: {
            entityId: f.invitationId,
            action: 'member.invitation_revoked',
          },
        });
        if (first === 'withdrawal') {
          expect({
            accepted: accepted.status,
            revoked: revoked.status,
            invitation: invitation.status,
            member: member?.status ?? null,
            joined,
            withdrawn,
          }).toEqual({
            accepted: 409,
            revoked: 204,
            invitation: 'REVOKED',
            member: null,
            joined: 0,
            withdrawn: 1,
          });
          expect(accepted.body.code).toBe('INVITATION_CLOSED');
          expect(invitation.revokedBy).toBe(f.owner.userId);
          expect(invitation.revokedAt).toBeInstanceOf(Date);
          expect(invitation.respondedBy).toBeNull();
          await f.customer.get('/v1/dealer').expect(401);
        } else {
          expect({
            accepted: accepted.status,
            revoked: revoked.status,
            invitation: invitation.status,
            member: member?.status ?? null,
            joined,
            withdrawn,
          }).toEqual({
            accepted: 200,
            revoked: 404,
            invitation: 'ACCEPTED',
            member: 'ACTIVE',
            joined: 1,
            withdrawn: 0,
          });
          expect(invitation.respondedBy).toBe(f.userId);
          expect(invitation.respondedAt).toBeInstanceOf(Date);
          expect(invitation.revokedAt).toBeNull();
          expect(member).toMatchObject({
            dealerId: f.owner.dealerId,
            userId: f.userId,
            role: 'STAFF',
            invitedBy: f.owner.userId,
          });
          await f.customer.get('/v1/dealer').expect(200);
        }
        await f.customer.get('/v1/auth/customer/me').expect(200);
      } finally {
        if (held) await holder.query('ROLLBACK');
        await Promise.allSettled(pending);
        await holder.end();
        await observer.end();
      }
    },
  );

  it('accepts the current role when owner renewal was queued first', async () => {
    const f = await pendingInvitation();
    const { holder, observer } = await lockDealer(f.owner.dealerId);
    const pending: Promise<unknown>[] = [];
    let held = true;
    try {
      const renewed = f.owner.agent
        .post('/v1/dealer/team/invitations')
        .send({ phone: f.phone, role: 'MANAGER' })
        .then((r) => r);
      pending.push(renewed);
      await waitForDealerWaiters(observer, 1);
      const accepted = f.customer.post(`/v1/invitations/${f.invitationId}/accept`).then((r) => r);
      pending.push(accepted);
      await waitForDealerWaiters(observer, 2);
      await holder.query('COMMIT');
      held = false;
      const [renewal, acceptance] = await Promise.all([renewed, accepted]);
      expect(renewal.status).toBe(201);
      expect(renewal.body.id).toBe(f.invitationId);
      expect(acceptance.status).toBe(200);
      expect(acceptance.body.role).toBe('MANAGER');
      expect(
        await h.prisma.dealerMember.findUniqueOrThrow({
          where: { dealerId_userId: { dealerId: f.owner.dealerId, userId: f.userId } },
        }),
      ).toMatchObject({ role: 'MANAGER', status: 'ACTIVE', invitedBy: f.owner.userId });
      expect(
        await h.prisma.dealerInvitation.count({
          where: { dealerId: f.owner.dealerId, phone: `+91${f.phone}` },
        }),
      ).toBe(1);
      expect(
        await h.prisma.auditLog.count({
          where: { dealerId: f.owner.dealerId, actorId: f.userId, action: 'member.joined' },
        }),
      ).toBe(1);
    } finally {
      if (held) await holder.query('ROLLBACK');
      await Promise.allSettled(pending);
      await holder.end();
      await observer.end();
    }
  });

  it('settles acceptance versus decline in one final state with matching membership', async () => {
    const f = await pendingInvitation();
    const [acceptance, decline] = await Promise.all([
      f.customer.post(`/v1/invitations/${f.invitationId}/accept`),
      f.customer.post(`/v1/invitations/${f.invitationId}/decline`),
    ]);
    const invitation = await h.prisma.dealerInvitation.findUniqueOrThrow({
      where: { id: f.invitationId },
    });
    const member = await h.prisma.dealerMember.findUnique({
      where: { dealerId_userId: { dealerId: f.owner.dealerId, userId: f.userId } },
    });
    if (acceptance.status === 200) {
      expect(decline.status).toBe(409);
      expect(invitation.status).toBe('ACCEPTED');
      expect(member?.status).toBe('ACTIVE');
    } else {
      expect(acceptance.status).toBe(409);
      expect(decline.status).toBe(204);
      expect(invitation.status).toBe('DECLINED');
      expect(member).toBeNull();
    }
    expect(invitation.respondedBy).toBe(f.userId);
    expect(invitation.respondedAt).toBeInstanceOf(Date);
  });

  it('reads suspension committed while acceptance waits on the dealership lock', async () => {
    const f = await pendingInvitation();
    const { holder, observer } = await lockDealer(f.owner.dealerId);
    let accepted: Promise<unknown> | undefined;
    let held = true;
    try {
      const response = f.customer.post(`/v1/invitations/${f.invitationId}/accept`).then((r) => r);
      accepted = response;
      await waitForDealerWaiters(observer, 1);
      await holder.query(
        'UPDATE "dealers" SET "status"=$2, "suspendedAt"=now() WHERE "id"=$1::uuid',
        [f.owner.dealerId, 'SUSPENDED'],
      );
      await holder.query('COMMIT');
      held = false;
      const result = await response;
      expect(result.status).toBe(409);
      expect(result.body.code).toBe('DEALERSHIP_NOT_ACCEPTING');
      expect(
        await h.prisma.dealerInvitation.findUniqueOrThrow({
          where: { id: f.invitationId },
        }),
      ).toMatchObject({
        status: 'PENDING',
        respondedAt: null,
        respondedBy: null,
      });
      expect(
        await h.prisma.dealerMember.findUnique({
          where: {
            dealerId_userId: { dealerId: f.owner.dealerId, userId: f.userId },
          },
        }),
      ).toBeNull();
      expect(
        await h.prisma.auditLog.count({
          where: {
            dealerId: f.owner.dealerId,
            actorId: f.userId,
            action: 'member.joined',
          },
        }),
      ).toBe(0);
    } finally {
      if (held) await holder.query('ROLLBACK');
      if (accepted) await Promise.allSettled([accepted]);
      await holder.end();
      await observer.end();
    }
  });
});
