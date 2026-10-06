import { setTimeout as pause } from 'node:timers/promises';

import { Client } from 'pg';
import type request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { createApprovalKit } from './approval-kit.js';
import { COMPLETE_VEHICLE, marketplaceFixtures } from './marketplace-fixtures.js';

let h: AuthHarness;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

async function observedListingWait(observer: Client, holderPid: number) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `SELECT pid FROM pg_stat_activity WHERE datname=current_database()
       AND state='active' AND wait_event_type='Lock' AND query ILIKE '%listings%'
       AND $1::int = ANY(pg_blocking_pids(pid))`,
      [holderPid],
    );
    if ((result.rowCount ?? 0) > 0) return;
    await pause(10);
  }
  throw new Error('No real listing write observed waiting on this independent blocker');
}

it('denies a queued listing submission when the owner removes its manager before the listing lock is released (BUG-005)', async () => {
  const fixtures = marketplaceFixtures(h, 'membership-commit');
  const owner = await fixtures.dealership();
  const manager = await fixtures.member(owner, 'MANAGER');
  const membership = await h.prisma.dealerMember.findFirstOrThrow({
    where: { dealerId: owner.dealerId, userId: manager.userId },
  });
  const created = await manager.agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: 'KL41MC7101' })
    .expect(201);
  const vehicleId = String(created.body.id);
  await manager.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
  const before = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId } });
  const vehicleBefore = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  const auditBefore = await h.prisma.auditLog.count({ where: { entityId: before.id } });
  const outboxBefore = await h.prisma.outboxEvent.count({ where: { aggregateId: before.id } });
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  const holderPid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [before.id]);
  let pending: Promise<{ status: number }> | undefined;
  let completed = false;
  try {
    pending = manager.agent.post(`/v1/dealer/vehicles/${vehicleId}/submit`).then((response) => {
      completed = true;
      return response;
    });
    await observedListingWait(observer, holderPid);
    expect(completed).toBe(false);
    await owner.agent.delete(`/v1/dealer/team/members/${membership.id}`).expect(204);
    const removed = await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: membership.id } });
    expect(removed.status).toBe('REMOVED');
    expect(removed.removedBy).toBe(owner.userId);
    expect(removed.removedAt).not.toBeNull();
    expect(completed).toBe(false);
    await holder.query('COMMIT');
    const response = await pending;
    const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: before.id } });
    const next = await manager.agent.get('/v1/dealer/vehicles');
    console.log(
      JSON.stringify({
        bug: 'BUG-005',
        canonicalTests: ['CONCURRENCY-007', 'CROSS-019'],
        lockWaitProven: true,
        revocationHttp: 204,
        membership: removed.status,
        submissionHttp: response.status,
        listing: listing.status,
        nextDealerRequest: next.status,
      }),
    );
    expect(response.status).toBe(401);
    expect(listing).toEqual(before);
    expect(await h.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).toEqual(
      vehicleBefore,
    );
    expect(await h.prisma.auditLog.count({ where: { entityId: before.id } })).toBe(auditBefore);
    expect(await h.prisma.outboxEvent.count({ where: { aggregateId: before.id } })).toBe(
      outboxBefore,
    );
    expect(next.status).toBe(401);
    await owner.agent.get(`/v1/dealer/vehicles/${vehicleId}`).expect(200);
  } finally {
    await holder.query('ROLLBACK');
    if (pending) await Promise.allSettled([pending]);
    await holder.end();
    await observer.end();
  }
});

let fixtureSequence = 0;
type StockState = 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';
type Write =
  'patch' | 'delete' | 'submit' | 'reserve' | 'mark-sold' | 'withdraw' | 'request-reactivation';
const initialState: Record<Write, StockState> = {
  patch: 'DRAFT',
  delete: 'DRAFT',
  submit: 'DRAFT',
  reserve: 'ACTIVE',
  'mark-sold': 'ACTIVE',
  withdraw: 'ACTIVE',
  'request-reactivation': 'WITHDRAWN',
};

async function stock(
  state: StockState = 'DRAFT',
  dealerState: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' = 'ACTIVE',
) {
  fixtureSequence += 1;
  const fixtures = marketplaceFixtures(h, `commit-${String(fixtureSequence)}`);
  const owner = await fixtures.dealership(dealerState);
  const manager = await fixtures.member(owner, 'MANAGER');
  const member = await h.prisma.dealerMember.findFirstOrThrow({
    where: { dealerId: owner.dealerId, userId: manager.userId },
  });
  const session = await h.prisma.session.findFirstOrThrow({
    where: { userId: manager.userId, revokedAt: null },
  });
  const admin = await fixtures.moderator();
  const registrationNumber = `KL41MC${String(7200 + fixtureSequence)}`;
  let vehicleId: string;
  if (state === 'DRAFT') {
    const created = await owner.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber })
      .expect(201);
    vehicleId = String(created.body.id);
    await owner.agent.patch(`/v1/dealer/vehicles/${vehicleId}`).send(COMPLETE_VEHICLE).expect(200);
  } else {
    const car = await createApprovalKit(h, admin).published(owner, registrationNumber);
    vehicleId = car.vehicleId;
    const buyer = h.agent();
    const phone = `98274${String(10000 + fixtureSequence)}`;
    const proved = await buyer
      .post('/v1/auth/sign-in/phone/customer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:commit-history-${String(fixtureSequence)}`,
      })
      .expect(200);
    await buyer
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName: 'Commit History Fixture' })
      .expect(201);
    await buyer.put(`/v1/saved-vehicles/${car.slug}`).expect(200);
    await buyer.post('/v1/enquiries').send({ listingSlug: car.slug }).expect(201);
    if (state !== 'ACTIVE') {
      const action = state === 'RESERVED' ? 'reserve' : state === 'SOLD' ? 'mark-sold' : 'withdraw';
      await owner.agent
        .post(`/v1/dealer/vehicles/${vehicleId}/${action}`)
        .send(action === 'withdraw' ? { reason: 'OTHER' } : {})
        .expect(200);
    }
  }
  const listing = await h.prisma.listing.findUniqueOrThrow({ where: { vehicleId } });
  return { owner, manager, member, session, admin, vehicleId, listing };
}
type Stock = Awaited<ReturnType<typeof stock>>;

function write(car: Stock, action: Write, agent = car.manager.agent): request.Test {
  const path = `/v1/dealer/vehicles/${car.vehicleId}`;
  if (action === 'patch') return agent.patch(path).send({ pricePaise: 120_000_000 });
  if (action === 'delete') return agent.delete(path);
  return agent
    .post(`${path}/${action}`)
    .send(
      action === 'withdraw'
        ? { reason: 'OTHER' }
        : action === 'request-reactivation'
          ? { reason: 'Interest returned for isolated regression' }
          : {},
    );
}

async function stockSnapshot(car: Stock) {
  return {
    vehicle: await h.prisma.vehicle.findUnique({ where: { id: car.vehicleId } }),
    listing: await h.prisma.listing.findUnique({ where: { id: car.listing.id } }),
    media: await h.prisma.media.findMany({
      where: { dealerId: car.owner.dealerId },
      orderBy: { id: 'asc' },
    }),
    attachments: await h.prisma.vehicleMedia.findMany({
      where: { vehicleId: car.vehicleId },
      orderBy: { id: 'asc' },
    }),
    enquiries: await h.prisma.enquiry.findMany({
      where: { listingId: car.listing.id },
      orderBy: { id: 'asc' },
    }),
    saved: await h.prisma.savedVehicle.findMany({
      where: { listingId: car.listing.id },
      orderBy: { id: 'asc' },
    }),
    reactivation: await h.prisma.listingReactivationRequest.findMany({
      where: { listingId: car.listing.id },
      orderBy: { id: 'asc' },
    }),
    audit: await h.prisma.auditLog.findMany({
      where: { entityId: { in: [car.vehicleId, car.listing.id] } },
      orderBy: { id: 'asc' },
    }),
    outbox: await h.prisma.outboxEvent.findMany({
      where: { aggregateId: { in: [car.vehicleId, car.listing.id] } },
      orderBy: { id: 'asc' },
    }),
  };
}

async function queued(car: Stock, action: Write, invalidate: () => Promise<unknown>) {
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [car.listing.id]);
  let completed = false;
  let pending: Promise<request.Response> | undefined;
  try {
    pending = write(car, action).then((response) => {
      completed = true;
      return response;
    });
    await observedListingWait(observer, pid);
    expect(completed).toBe(false);
    await invalidate();
    expect(completed).toBe(false);
    await holder.query('COMMIT');
    return await pending;
  } finally {
    await holder.query('ROLLBACK');
    if (pending) await Promise.allSettled([pending]);
    await holder.end();
    await observer.end();
  }
}

it.each([
  'patch',
  'delete',
  'submit',
  'reserve',
  'mark-sold',
  'withdraw',
  'request-reactivation',
] as const)(
  'blocks queued %s after actual membership removal without changing history',
  async (action) => {
    const car = await stock(initialState[action]);
    const before = await stockSnapshot(car);
    const response = await queued(car, action, async () => {
      await car.owner.agent.delete(`/v1/dealer/team/members/${car.member.id}`).expect(204);
      expect(
        await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: car.member.id } }),
      ).toMatchObject({ status: 'REMOVED', removedBy: car.owner.userId });
    });
    expect(response.status).toBe(401);
    expect(await stockSnapshot(car)).toEqual(before);
    await car.manager.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(401);
    await car.owner.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
    const removedAudit = await h.prisma.auditLog.findFirstOrThrow({
      where: { entityId: car.member.id, action: 'member.removed' },
    });
    expect(removedAudit.actorId).toBe(car.owner.userId);
  },
);

it.each(['delete', 'submit', 'reserve', 'mark-sold', 'withdraw', 'request-reactivation'] as const)(
  'blocks queued %s when the manager is downgraded to STAFF',
  async (action) => {
    const car = await stock(initialState[action]);
    const before = await stockSnapshot(car);
    const response = await queued(car, action, async () => {
      await car.owner.agent
        .patch(`/v1/dealer/team/members/${car.member.id}`)
        .send({ role: 'STAFF' })
        .expect(200);
    });
    expect(response.status).toBe(403);
    expect(await stockSnapshot(car)).toEqual(before);
    await car.manager.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
    expect((await car.manager.agent.get('/v1/auth/me').expect(200)).body.role).toBe('STAFF');
  },
);

it('retains a permitted queued STAFF draft edit and returns freshly restricted capabilities', async () => {
  const car = await stock();
  const response = await queued(car, 'patch', async () => {
    await car.owner.agent
      .patch(`/v1/dealer/team/members/${car.member.id}`)
      .send({ role: 'STAFF' })
      .expect(200);
  });
  expect(response.status).toBe(200);
  expect(response.body.listing.canDelete).toBe(false);
  expect(
    (await h.prisma.vehicle.findUniqueOrThrow({ where: { id: car.vehicleId } })).pricePaise,
  ).toBe(120_000_000n);
});

it.each(['patch', 'submit', 'mark-sold', 'request-reactivation'] as const)(
  'blocks queued %s after actual dealer suspension and preserves its related history',
  async (action) => {
    const car = await stock(initialState[action]);
    const before = await stockSnapshot(car);
    const response = await queued(car, action, async () => {
      await car.admin
        .post(`/v1/admin/dealers/${car.owner.dealerId}/suspend`)
        .send({ reason: 'Controlled queued write suspension' })
        .expect(200);
      expect(
        (await h.prisma.dealer.findUniqueOrThrow({ where: { id: car.owner.dealerId } })).status,
      ).toBe('SUSPENDED');
    });
    expect(response.status).toBe(401);
    expect(await stockSnapshot(car)).toEqual(before);
    await car.manager.agent.get('/v1/dealer/vehicles').expect(401);
    await car.admin.post(`/v1/admin/dealers/${car.owner.dealerId}/reinstate`).send({}).expect(200);
    await car.manager.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
    expect(await stockSnapshot(car)).toEqual(before);
  },
);

it('blocks the old queued session after logout and permits a fresh login with intact membership', async () => {
  const car = await stock();
  const before = await stockSnapshot(car);
  const response = await queued(car, 'submit', async () => {
    await car.manager.agent.post('/v1/auth/logout').expect(204);
    expect(
      (await h.prisma.session.findUniqueOrThrow({ where: { id: car.session.id } })).revokedAt,
    ).not.toBeNull();
  });
  expect(response.status).toBe(401);
  expect(await stockSnapshot(car)).toEqual(before);
  await car.manager.agent.get('/v1/dealer/vehicles').expect(401);
  const user = await h.prisma.user.findUniqueOrThrow({ where: { id: car.manager.userId } });
  const phone = String(user.phone).slice(3);
  await car.manager.agent
    .post('/v1/auth/sign-in/phone/dealer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:fresh-commit-session`,
    })
    .expect(200);
  await car.manager.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(200);
  await write(car, 'submit').expect(200);
});

it.each(['account', 'seat', 'expiry'] as const)(
  'blocks a queued submission after persistent %s authority changes',
  async (change) => {
    const car = await stock();
    const before = await stockSnapshot(car);
    const response = await queued(car, 'submit', async () => {
      if (change === 'account')
        await h.prisma.user.update({
          where: { id: car.manager.userId },
          data: { status: 'SUSPENDED' },
        });
      if (change === 'seat')
        await h.prisma.userRole.update({
          where: { userId_role: { userId: car.manager.userId, role: 'DEALER' } },
          data: { status: 'SUSPENDED' },
        });
      if (change === 'expiry')
        await h.prisma.session.update({
          where: { id: car.session.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
    });
    expect(response.status).toBe(401);
    expect(await stockSnapshot(car)).toEqual(before);
  },
);

it.each(['dealer', 'member', 'user', 'seat', 'session'] as const)(
  'fails closed with a retryable conflict while the %s authority row is held',
  async (held) => {
    const car = await stock();
    const before = await stockSnapshot(car);
    const holder = new Client({ connectionString: env.DATABASE_URL });
    await holder.connect();
    await holder.query('BEGIN');
    try {
      const queries = {
        dealer: ['SELECT id FROM dealers WHERE id=$1 FOR UPDATE', car.owner.dealerId],
        member: ['SELECT id FROM dealer_members WHERE id=$1 FOR UPDATE', car.member.id],
        user: ['SELECT id FROM users WHERE id=$1 FOR UPDATE', car.manager.userId],
        seat: [
          'SELECT id FROM user_roles WHERE "userId"=$1 AND role=\'DEALER\' FOR UPDATE',
          car.manager.userId,
        ],
        session: ['SELECT id FROM sessions WHERE id=$1 FOR UPDATE', car.session.id],
      };
      const query = queries[held];
      await holder.query(query[0] ?? '', [query[1]]);
      const response = await write(car, 'submit');
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('AUTHORIZATION_BUSY');
      expect(await stockSnapshot(car)).toEqual(before);
      await holder.query('COMMIT');
      await write(car, 'submit').expect(200);
    } finally {
      await holder.query('ROLLBACK');
      await holder.end();
    }
  },
);

it.each(['DRAFT', 'PENDING_APPROVAL'] as const)(
  'preserves permitted draft preparation for a %s dealer',
  async (status) => {
    const car = await stock('DRAFT', status);
    await write(car, 'patch').expect(200);
    await write(car, 'submit').expect(403);
    await write(car, 'delete').expect(204);
  },
);

it('keeps personal customer authority and foreign-dealer isolation after membership removal', async () => {
  const car = await stock();
  const foreign = await stock();
  await car.manager.agent
    .patch(`/v1/dealer/vehicles/${foreign.vehicleId}`)
    .send({ make: 'Cross dealer forbidden' })
    .expect(404);
  await car.manager.agent
    .post('/v1/dealer/vehicles')
    .send({
      registrationNumber: 'KL41MC7999',
      dealerId: foreign.owner.dealerId,
      userId: foreign.manager.userId,
      sessionId: foreign.session.id,
    })
    .expect(400);
  const user = await h.prisma.user.findUniqueOrThrow({ where: { id: car.manager.userId } });
  const phone = String(user.phone).slice(3);
  const customer = h.agent();
  await customer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:customer-after-removal`,
    })
    .expect(200);
  await car.owner.agent.delete(`/v1/dealer/team/members/${car.member.id}`).expect(204);
  await car.manager.agent.get('/v1/dealer/vehicles').expect(401);
  await customer.get('/v1/auth/customer/me').expect(200);
  await customer.get('/v1/enquiries').expect(200);
  await customer.get('/v1/saved-vehicles').expect(200);
  await customer.post('/v1/dealer/vehicles').send({ registrationNumber: 'KL41MC7998' }).expect(401);
  await foreign.manager.agent.get(`/v1/dealer/vehicles/${foreign.vehicleId}`).expect(200);
});

it('preserves existing neutral absent-seat semantics for a member using a real customer session', async () => {
  const car = await stock();
  const user = await h.prisma.user.findUniqueOrThrow({ where: { id: car.manager.userId } });
  const phone = String(user.phone).slice(3);
  const customer = h.agent();
  await customer
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:absent-seat-customer`,
    })
    .expect(200);
  await h.prisma.userRole.deleteMany({ where: { userId: car.manager.userId, role: 'DEALER' } });
  const me = await customer.get('/v1/auth/me').expect(200);
  expect(me.body.role).toBe('MANAGER');
  expect(JSON.stringify(me.body)).not.toContain('sessionId');
  await write(car, 'patch', customer).expect(200);
  await write(car, 'submit', customer).expect(200);
});

async function observedQueryWait(observer: Client, part: string, blockerPid?: number) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND state='active'
       AND wait_event_type='Lock' AND query ILIKE $1
       AND ($2::int IS NULL OR $2::int = ANY(pg_blocking_pids(pid)))`,
      [part, blockerPid ?? null],
    );
    if (result.rows[0]) return Number(result.rows[0].pid);
    await pause(10);
  }
  throw new Error('Expected independently observed operation lock wait');
}

it.each(['submit', 'patch'] as const)(
  'serializes removal after an already authorized %s and records the correct actor',
  async (action) => {
    const car = await stock();
    const holder = new Client({ connectionString: env.DATABASE_URL });
    const observer = new Client({ connectionString: env.DATABASE_URL });
    await holder.connect();
    await observer.connect();
    await holder.query('BEGIN');
    const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    await holder.query('LOCK TABLE audit_logs IN ACCESS EXCLUSIVE MODE');
    let mutation: Promise<request.Response> | undefined;
    let removal: Promise<request.Response> | undefined;
    let removed = false;
    try {
      mutation = write(car, action).then((response) => response);
      const writerPid = await observedQueryWait(observer, '%INSERT INTO%audit_logs%', pid);
      removal = car.owner.agent
        .delete(`/v1/dealer/team/members/${car.member.id}`)
        .then((response) => {
          removed = true;
          return response;
        });
      await observedQueryWait(observer, '%SELECT "id" FROM "dealers"%', writerPid);
      expect(removed).toBe(false);
      await holder.query('COMMIT');
      const [written, revoked] = await Promise.all([mutation, removal]);
      expect(written.status).toBe(200);
      expect(revoked.status).toBe(204);
      expect(
        (await h.prisma.dealerMember.findUniqueOrThrow({ where: { id: car.member.id } })).status,
      ).toBe('REMOVED');
      const audit = await h.prisma.auditLog.findMany({
        where: { actorId: car.manager.userId, entityId: { in: [car.vehicleId, car.listing.id] } },
      });
      expect(audit.length).toBeGreaterThan(0);
      expect(
        audit.every((row) => row.actorType === 'DEALER' && row.dealerId === car.owner.dealerId),
      ).toBe(true);
      expect(
        (await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listing.id } })).status,
      ).toBe(action === 'submit' ? 'PENDING_REVIEW' : 'DRAFT');
      await car.manager.agent.get('/v1/dealer/vehicles').expect(401);
    } finally {
      await holder.query('ROLLBACK');
      await Promise.allSettled(
        [mutation, removal].filter((p): p is Promise<request.Response> => p !== undefined),
      );
      await holder.end();
      await observer.end();
    }
  },
);

it('does not deadlock an authorized-resource guard against actual destructive dealer rejection', async () => {
  const car = await stock('DRAFT', 'DRAFT');
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('SELECT id FROM listings WHERE id=$1 FOR UPDATE', [car.listing.id]);
  let edit: Promise<request.Response> | undefined;
  let rejection: Promise<request.Response> | undefined;
  try {
    edit = write(car, 'patch').then((response) => response);
    await observedListingWait(observer, pid);
    rejection = car.admin
      .post(`/v1/admin/dealers/${car.owner.dealerId}/reject`)
      .send({ reason: 'Controlled authorization cascade contention' })
      .then((response) => response);
    await observedQueryWait(observer, '%DELETE FROM%dealers%');
    await holder.query('COMMIT');
    const [changed, rejected] = await Promise.all([edit, rejection]);
    expect(changed.status).toBe(409);
    expect(changed.body.code).toBe('AUTHORIZATION_BUSY');
    expect(rejected.status).toBe(200);
    expect(await h.prisma.dealer.findUnique({ where: { id: car.owner.dealerId } })).toBeNull();
    expect(await h.prisma.vehicle.findUnique({ where: { id: car.vehicleId } })).toBeNull();
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: car.vehicleId, action: 'vehicle.updated', actorId: car.manager.userId },
      }),
    ).toBe(0);
    expect(
      await h.prisma.auditLog.count({
        where: { entityId: car.owner.dealerId, action: 'dealer.rejected' },
      }),
    ).toBe(1);
  } finally {
    await holder.query('ROLLBACK');
    await Promise.allSettled(
      [edit, rejection].filter((p): p is Promise<request.Response> => p !== undefined),
    );
    await holder.end();
    await observer.end();
  }
});

it('does not create stock or audit while the dealership authority is locked by another operation', async () => {
  const car = await stock();
  const before = await h.prisma.vehicle.count({ where: { dealerId: car.owner.dealerId } });
  const audits = await h.prisma.auditLog.count({
    where: { dealerId: car.owner.dealerId, action: 'vehicle.created' },
  });
  const holder = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await holder.query('BEGIN');
  try {
    await holder.query('SELECT id FROM dealers WHERE id=$1 FOR UPDATE', [car.owner.dealerId]);
    const response = await car.manager.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'KL41MC7997' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('AUTHORIZATION_BUSY');
    expect(await h.prisma.vehicle.count({ where: { dealerId: car.owner.dealerId } })).toBe(before);
    expect(
      await h.prisma.auditLog.count({
        where: { dealerId: car.owner.dealerId, action: 'vehicle.created' },
      }),
    ).toBe(audits);
    await holder.query('COMMIT');
    await car.manager.agent
      .post('/v1/dealer/vehicles')
      .send({ registrationNumber: 'KL41MC7997' })
      .expect(201);
  } finally {
    await holder.query('ROLLBACK');
    await holder.end();
  }
});

it('does not transfer a queued write to a different workspace after its exact membership is removed', async () => {
  const car = await stock();
  const other = await stock();
  await h.prisma.dealerMember.create({
    data: {
      dealerId: other.owner.dealerId,
      userId: car.manager.userId,
      role: 'STAFF',
      permissions: [],
    },
  });
  const before = await stockSnapshot(car);
  const response = await queued(car, 'submit', async () => {
    await car.owner.agent.delete(`/v1/dealer/team/members/${car.member.id}`).expect(204);
  });
  expect(response.status).toBe(401);
  expect(await stockSnapshot(car)).toEqual(before);
  const me = await car.manager.agent.get('/v1/auth/me').expect(200);
  expect(me.body.dealer.id).toBe(other.owner.dealerId);
  expect(me.body.role).toBe('STAFF');
  await car.manager.agent.get(`/v1/dealer/vehicles/${car.vehicleId}`).expect(404);
  await car.manager.agent.get(`/v1/dealer/vehicles/${other.vehicleId}`).expect(200);
});

it('holds absent-seat authorization through commit so a new suspended seat cannot race its authority check', async () => {
  const car = await stock();
  await h.prisma.userRole.deleteMany({ where: { userId: car.manager.userId, role: 'DEALER' } });
  const holder = new Client({ connectionString: env.DATABASE_URL });
  const observer = new Client({ connectionString: env.DATABASE_URL });
  await holder.connect();
  await observer.connect();
  await holder.query('BEGIN');
  const pid = Number((await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  await holder.query('LOCK TABLE audit_logs IN ACCESS EXCLUSIVE MODE');
  let mutation: Promise<request.Response> | undefined;
  let insertion: Promise<unknown> | undefined;
  let seatCreated = false;
  try {
    mutation = write(car, 'submit').then((response) => response);
    const writer = await observedQueryWait(observer, '%INSERT INTO%audit_logs%', pid);
    insertion = h.prisma.userRole
      .create({ data: { userId: car.manager.userId, role: 'DEALER', status: 'SUSPENDED' } })
      .then((row) => {
        seatCreated = true;
        return row;
      });
    await observedQueryWait(observer, '%INSERT INTO%user_roles%', writer);
    expect(seatCreated).toBe(false);
    await holder.query('COMMIT');
    expect((await mutation).status).toBe(200);
    await insertion;
    expect(seatCreated).toBe(true);
    await car.manager.agent.get('/v1/dealer/vehicles').expect(401);
  } finally {
    await holder.query('ROLLBACK');
    await Promise.allSettled(
      [mutation, insertion].filter((p): p is Promise<unknown> => p !== undefined),
    );
    await holder.end();
    await observer.end();
  }
});
