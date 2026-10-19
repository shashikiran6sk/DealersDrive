import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { createAuthHarness } from '../../../apps/api/tests/auth-harness.js';
import {
  marketplaceFixtures,
  COMPLETE_VEHICLE,
} from '../../../apps/api/tests/marketplace-fixtures.js';
import { createApprovalKit } from '../../../apps/api/tests/approval-kit.js';
import { env } from '../../../apps/api/src/config/env.js';
import { createSessionService } from '../../../apps/api/src/modules/auth/session.service.js';
import { createLocalStorage } from '../../../apps/api/src/platform/storage/local.adapter.js';

assert.equal(new URL(env.DATABASE_URL).hostname, 'localhost');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.equal(env.PHONE_OTP_DRIVER, 'fake');
assert.equal(env.AUTH_MODE, 'cookie');

const h = await createAuthHarness();
const f = marketplaceFixtures(h, 'certification');
const admin = await f.moderator();
const kit = createApprovalKit(h, admin);
const a = await f.dealership();
const b = await f.dealership();
const manager = await f.member(a, 'MANAGER');
const staff = await f.member(a, 'STAFF');
const car = await kit.published(a, 'TN22QA8101');
const other = await kit.published(b, 'TN22QA8102');
const other2 = await kit.published(b, 'TN22QA8103');
const other3 = await kit.published(b, 'TN22QA8104');
const results: unknown[] = [];
let proof = 0;

async function check(id: string, ids: string[], title: string, run: () => Promise<unknown>) {
  try {
    const observed = await run();
    results.push({
      id,
      canonical: ids,
      title,
      status: 'PASS',
      observed,
      method: 'HTTP_API_AND_POSTGRES',
      sha: process.env.GIT_SHA,
    });
    console.log(id, 'PASS');
  } catch (error) {
    results.push({
      id,
      canonical: ids,
      title,
      status: 'FAIL',
      error: error instanceof Error ? error.message.slice(0, 600) : 'Unexpected error',
      method: 'HTTP_API_AND_POSTGRES',
      sha: process.env.GIT_SHA,
    });
    console.log(id, 'FAIL');
  }
}

async function customer(phone: string, name: string) {
  const agent = h.agent();
  const login = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:cert-${++proof}` });
  assert.equal(login.status, 200);
  if (login.body.status === 'NAME_REQUIRED') {
    await agent
      .post('/v1/auth/sign-up/customer')
      .send({ fullName: name, signUpToken: login.body.signUpToken })
      .expect(201);
  }
  return agent;
}

const buyer = await customer('9000081001', 'Certification Customer');
const staffPhone = (await h.prisma.user.findUniqueOrThrow({ where: { id: staff.userId } })).phone!;
const staffPersonal = await customer(staffPhone.slice(-10), 'Certification Staff');
const staffMembership = await h.prisma.dealerMember.findUniqueOrThrow({
  where: { dealerId_userId: { dealerId: a.dealerId, userId: staff.userId } },
});
const managerMembership = await h.prisma.dealerMember.findUniqueOrThrow({
  where: { dealerId_userId: { dealerId: a.dealerId, userId: manager.userId } },
});

await check(
  'API-PROBE-001',
  ['API-SEC-001'],
  'Anonymous requests cannot enter private resource collections',
  async () => {
    const observed = [];
    for (const path of [
      '/v1/dealer/vehicles',
      '/v1/dealer/team',
      '/v1/dealer/enquiries',
      '/v1/admin/dealers',
      '/v1/admin/enquiries',
      '/v1/saved-vehicles',
      '/v1/enquiries',
    ]) {
      const r = await h.agent().get(path);
      assert.equal(r.status, 401);
      observed.push({ path, status: r.status });
    }
    return observed;
  },
);
await check(
  'API-PROBE-002',
  ['API-SEC-002', 'IDENTITY-004'],
  'Customer with no membership cannot enter dealer APIs',
  async () => {
    const r = await buyer.get('/v1/dealer/vehicles');
    assert.equal(r.status, 401);
    return { status: r.status };
  },
);
await check(
  'API-PROBE-003',
  ['API-SEC-003', 'STAFF-005', 'STAFF-006', 'STAFF-007', 'STAFF-008'],
  'STAFF direct listing transitions fail',
  async () => {
    const observed = [];
    for (const action of ['submit', 'reserve', 'mark-sold', 'withdraw']) {
      const r = await staff.agent
        .post(`/v1/dealer/vehicles/${car.vehicleId}/${action}`)
        .send(action === 'withdraw' ? { reason: 'OTHER', note: 'certification' } : {});
      assert.equal(r.status, 403);
      observed.push({ action, status: r.status });
    }
    return observed;
  },
);
await check(
  'API-PROBE-004',
  ['API-SEC-004', 'MANAGER-011', 'STAFF-015'],
  'MANAGER and STAFF cannot manage Team',
  async () => {
    for (const person of [manager, staff]) {
      const r = await person.agent
        .post('/v1/dealer/team/invitations')
        .send({ phone: '9000081999', role: 'STAFF' });
      assert.equal(r.status, 403);
    }
    return { denied: 2 };
  },
);
await check(
  'API-PROBE-005',
  ['API-SEC-005', 'ADMIN-AUTH-003', 'ADMIN-AUTH-004', 'ADMIN-AUTH-005', 'ADMIN-AUTH-006'],
  'All non-admin account types fail Admin API access',
  async () => {
    for (const agent of [a.agent, manager.agent, staff.agent, buyer])
      assert.equal((await agent.get('/v1/admin/enquiries')).status, 401);
    return { denied: 4 };
  },
);
await check(
  'API-PROBE-006',
  ['API-SEC-006', 'LISTING-CREATE-016'],
  'Cross-dealer vehicle read/edit/delete is indistinguishable from missing ID',
  async () => {
    const statuses = [];
    for (const id of [other.vehicleId, '00000000-0000-4000-8000-000000000000']) {
      const r = await a.agent.get(`/v1/dealer/vehicles/${id}`);
      statuses.push(r.status);
      assert.equal(r.status, 404);
    }
    const before = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: other.vehicleId } });
    assert.equal(
      (await a.agent.patch(`/v1/dealer/vehicles/${other.vehicleId}`).send({ make: 'Tampered' }))
        .status,
      404,
    );
    assert.equal((await a.agent.delete(`/v1/dealer/vehicles/${other.vehicleId}`)).status, 404);
    assert.equal(
      (await h.prisma.vehicle.findUniqueOrThrow({ where: { id: other.vehicleId } })).make,
      before.make,
    );
    return { statuses, foreignRowUnchanged: true };
  },
);
await check(
  'API-PROBE-007',
  ['API-SEC-008'],
  'Malformed UUID returns a controlled validation response',
  async () => {
    const r = await a.agent.get('/v1/dealer/vehicles/not-a-uuid');
    assert.equal(r.status, 400);
    assert.ok(!JSON.stringify(r.body).includes('Prisma'));
    return { status: r.status };
  },
);
await check(
  'API-PROBE-008',
  ['API-SEC-009', 'API-SEC-010', 'LISTING-CREATE-011'],
  'Unknown privilege and ownership fields are rejected',
  async () => {
    for (const field of ['dealerId', 'role', 'verificationStatus', 'status', 'createdByUserId']) {
      const r = await a.agent
        .patch(`/v1/dealer/vehicles/${car.vehicleId}`)
        .send({ [field]: b.dealerId });
      assert.equal(r.status, 400);
    }
    return { rejectedFields: 5 };
  },
);
await check(
  'API-PROBE-009',
  ['ENQ-CREATE-001', 'ENQ-CREATE-004', 'ENQ-CREATE-005', 'ENQ-CREATE-013'],
  'Enquiries created with and without optional description reach customer history',
  async () => {
    await buyer.post('/v1/enquiries').send({ listingSlug: other.slug }).expect(201);
    await buyer
      .post('/v1/enquiries')
      .send({ listingSlug: other2.slug, message: 'Certification enquiry.' })
      .expect(201);
    const r = await buyer.get('/v1/enquiries');
    assert.equal(r.body.data.length, 2);
    return { historyCount: r.body.data.length };
  },
);
await check(
  'API-PROBE-010',
  ['ENQ-CREATE-012'],
  'Concurrent duplicate enquiries produce exactly one stored lead',
  async () => {
    const r = await Promise.all(
      Array.from({ length: 5 }, () =>
        buyer.post('/v1/enquiries').send({ listingSlug: other3.slug }),
      ),
    );
    assert.equal(r.filter((x) => x.status === 201).length, 1);
    assert.equal(await h.prisma.enquiry.count({ where: { listingId: other3.listingId } }), 1);
    return { statuses: r.map((x) => x.status), stored: 1 };
  },
);
await check(
  'API-PROBE-011',
  ['SAVED-001', 'SAVED-004'],
  'Concurrent duplicate save remains one row',
  async () => {
    const r = await Promise.all(
      Array.from({ length: 5 }, () => buyer.put(`/v1/saved-vehicles/${other.slug}`)),
    );
    assert.ok(r.every((x) => x.status === 200));
    assert.equal(await h.prisma.savedVehicle.count({ where: { listingId: other.listingId } }), 1);
    return { stored: 1 };
  },
);
await check(
  'API-PROBE-012',
  ['IDENTITY-003', 'IDENTITY-005', 'IDENTITY-006'],
  'STAFF customer session enters its dealership without another sign-in',
  async () => {
    const before = await h.prisma.session.count({ where: { userId: staff.userId } });
    await staffPersonal.get('/v1/dealer/vehicles').expect(200);
    await staffPersonal.get('/v1/auth/customer/me').expect(200);
    assert.equal(await h.prisma.session.count({ where: { userId: staff.userId } }), before);
    return { newSessions: 0 };
  },
);
const draft = await staffPersonal
  .post('/v1/dealer/vehicles')
  .send({ registrationNumber: 'TN22QA8190' })
  .expect(201);
await staffPersonal.put(`/v1/saved-vehicles/${other.slug}`).expect(200);
const staffEnquiry = await staffPersonal
  .post('/v1/enquiries')
  .send({ listingSlug: other.slug })
  .expect(201);
await check(
  'API-PROBE-013',
  ['LISTING-CREATE-003', 'LISTING-CREATE-004', 'LISTING-CREATE-005'],
  'STAFF draft records dealership ownership and human actor',
  async () => {
    const v = await h.prisma.vehicle.findUniqueOrThrow({ where: { id: draft.body.id } });
    assert.equal(v.dealerId, a.dealerId);
    assert.equal(v.createdBy, staff.userId);
    return { correctOwnerAndActor: true };
  },
);
await check(
  'API-PROBE-014',
  [
    'MEMBER-019',
    'MEMBER-020',
    'MEMBER-021',
    'MEMBER-022',
    'MEMBER-023',
    'MEMBER-024',
    'MEMBER-025',
    'MEMBER-026',
    'MEMBER-027',
    'MEMBER-028',
    'IDENTITY-010',
    'IDENTITY-011',
    'CROSS-015',
    'CROSS-024',
    'CROSS-025',
    'DATA-001',
  ],
  'Revocation denies stale dealer sessions but preserves personal records and draft ownership',
  async () => {
    await a.agent.delete(`/v1/dealer/team/members/${staffMembership.id}`).expect(204);
    await staffPersonal.get('/v1/dealer/vehicles').expect(401);
    await staff.agent
      .patch(`/v1/dealer/vehicles/${draft.body.id}`)
      .send({ make: 'Denied' })
      .expect(401);
    await staffPersonal.get('/v1/auth/customer/me').expect(200);
    const saved = await staffPersonal.get('/v1/saved-vehicles');
    assert.equal(saved.body.data.length, 1);
    const enq = await staffPersonal.get('/v1/enquiries');
    assert.equal(enq.body.data.length, 1);
    assert.ok(await h.prisma.vehicle.findUnique({ where: { id: draft.body.id } }));
    assert.ok(await h.prisma.enquiry.findUnique({ where: { id: staffEnquiry.body.id } }));
    const member = await h.prisma.dealerMember.findUniqueOrThrow({
      where: { id: staffMembership.id },
    });
    assert.equal(member.status, 'REMOVED');
    return {
      staleDealerDenied: true,
      customerAccessible: true,
      saved: 1,
      enquiries: 1,
      draftPreserved: true,
    };
  },
);
await check(
  'API-PROBE-015',
  ['MEMBER-014', 'MEMBER-015', 'MEMBER-016'],
  'Role downgrade and upgrade affect existing session immediately',
  async () => {
    await a.agent
      .patch(`/v1/dealer/team/members/${managerMembership.id}`)
      .send({ role: 'STAFF' })
      .expect(200);
    await manager.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/reserve`).expect(403);
    await a.agent
      .patch(`/v1/dealer/team/members/${managerMembership.id}`)
      .send({ role: 'MANAGER' })
      .expect(200);
    await manager.agent.post(`/v1/dealer/vehicles/${car.vehicleId}/reserve`).expect(200);
    assert.equal(
      (await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } })).status,
      'RESERVED',
    );
    return { downgradeDenied: true, upgradeAllowed: true };
  },
);
await check(
  'API-PROBE-016',
  [
    'DEALER-LIFE-002',
    'DEALER-LIFE-003',
    'DEALER-LIFE-004',
    'DEALER-LIFE-007',
    'DEALER-LIFE-014',
    'CROSS-001',
    'CROSS-002',
    'CROSS-003',
  ],
  'Suspension and reinstatement preserve data and close existing dealership sessions',
  async () => {
    const before = {
      vehicles: await h.prisma.vehicle.count({ where: { dealerId: a.dealerId } }),
      members: await h.prisma.dealerMember.count({ where: { dealerId: a.dealerId } }),
    };
    await admin
      .post(`/v1/admin/dealers/${a.dealerId}/suspend`)
      .send({ reason: 'Isolated certification suspension.' })
      .expect(200);
    await manager.agent.get('/v1/dealer/vehicles').expect(401);
    await staffPersonal.get('/v1/auth/customer/me').expect(200);
    const hidden = await buyer.get(`/v1/vehicles/${car.slug}`);
    assert.equal(hidden.status, 404);
    assert.equal(
      (await h.prisma.listing.findUniqueOrThrow({ where: { id: car.listingId } })).status,
      'RESERVED',
    );
    await admin
      .post(`/v1/admin/dealers/${a.dealerId}/reinstate`)
      .send({ note: 'Certification complete.' })
      .expect(200);
    await manager.agent.get('/v1/dealer/vehicles').expect(200);
    await staffPersonal.get('/v1/dealer/vehicles').expect(401);
    assert.equal(
      await h.prisma.vehicle.count({ where: { dealerId: a.dealerId } }),
      before.vehicles,
    );
    assert.equal(
      await h.prisma.dealerMember.count({ where: { dealerId: a.dealerId } }),
      before.members,
    );
    return { preservedCounts: true, revokedStillDenied: true, reservedPreserved: true };
  },
);

await check(
  'SEC-DISC-001',
  ['VERIFY-011'],
  'Incomplete DRAFT dealer cannot be approved by direct Admin API',
  async () => {
    const incomplete = await f.dealership('DRAFT');
    const docs = await h.prisma.dealerDocument.findMany({
      where: { dealerId: incomplete.dealerId },
    });
    const r = await admin.post(`/v1/admin/dealers/${incomplete.dealerId}/approve`).send({});
    const state = await h.prisma.dealer.findUniqueOrThrow({ where: { id: incomplete.dealerId } });
    results.push({
      id: 'SEC-DISC-001-OBSERVED',
      canonical: [],
      title: 'Approval evidence',
      status: 'OBSERVATION',
      observed: {
        before: 'DRAFT',
        documentStatuses: docs.map((d) => d.status),
        http: r.status,
        after: state.status,
      },
      sha: process.env.GIT_SHA,
    });
    assert.ok(
      r.status >= 400 && state.status !== 'ACTIVE',
      `HTTP ${r.status}; incomplete DRAFT dealer became ${state.status}; ${docs.length} documents were ${docs.map((d) => d.status).join(',')}`,
    );
    return { status: r.status, state: state.status };
  },
);

await check(
  'DATA-DISC-001',
  [],
  'Customer enquiry cursor preserves rows with equal timestamps',
  async () => {
    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: '+919000081001' } });
    const timestamp = new Date('2026-10-02T01:00:00Z');
    await h.prisma.enquiry.updateMany({
      where: { customerId: user.id },
      data: { createdAt: timestamp },
    });
    const first = await buyer.get('/v1/enquiries?limit=1').expect(200);
    const second = await buyer
      .get('/v1/enquiries')
      .query({ limit: 1, cursor: first.body.page.nextCursor })
      .expect(200);
    assert.equal(
      second.body.data.length,
      1,
      `DB has 3 equal-timestamp enquiries; page 1 has ${first.body.data.length}, hasMore=${first.body.page.hasMore}; page 2 has ${second.body.data.length}`,
    );
    return { secondPage: second.body.data.length };
  },
);
await check(
  'DATA-DISC-002',
  [],
  'Saved-car cursor preserves rows with equal timestamps',
  async () => {
    await buyer.put(`/v1/saved-vehicles/${other2.slug}`).expect(200);
    await buyer.put(`/v1/saved-vehicles/${other3.slug}`).expect(200);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: '+919000081001' } });
    await h.prisma.savedVehicle.updateMany({
      where: { customerId: user.id },
      data: { createdAt: new Date('2026-10-02T01:00:00Z') },
    });
    const first = await buyer.get('/v1/saved-vehicles?limit=1').expect(200);
    const second = await buyer
      .get('/v1/saved-vehicles')
      .query({ limit: 1, cursor: first.body.page.nextCursor })
      .expect(200);
    assert.equal(
      second.body.data.length,
      1,
      `DB has 3 equal-timestamp saved records; page 1 has ${first.body.data.length}, hasMore=${first.body.page.hasMore}; page 2 has ${second.body.data.length}`,
    );
    return { secondPage: second.body.data.length };
  },
);

// Give the unchanged browser application fictional, visible fixture labels.
for (const [person, name, phone] of [
  [a, 'Certification Owner', '+919000081010'],
  [b, 'Other Dealer Owner', '+919000081020'],
  [manager, 'Certification Manager', '+919000081011'],
  [staff, 'Certification Staff', '+919000081012'],
] as const) {
  await h.prisma.user.update({ where: { id: person.userId }, data: { fullName: name, phone } });
}
await h.prisma.dealer.update({
  where: { id: a.dealerId },
  data: { brandName: 'Certification Motors A' },
});
await h.prisma.dealer.update({
  where: { id: b.dealerId },
  data: { brandName: 'Certification Motors B' },
});
const sharp = createRequire(new URL('../../../apps/api/package.json', import.meta.url))('sharp');
const storage = createLocalStorage();
for (const published of [car, other, other2, other3]) {
  for (const [index, id] of published.mediaIds.entries()) {
    const media = await h.prisma.media.findUniqueOrThrow({ where: { id } });
    const data = await sharp({
      create: {
        width: 1024,
        height: 640,
        channels: 3,
        background: { r: 80 + index * 20, g: 105, b: 125 },
      },
    })
      .jpeg()
      .toBuffer();
    await storage.put(media.storageKey, data);
  }
}
const adminUser = await h.prisma.user.findUniqueOrThrow({
  where: { email: env.adminAllowlist[0] },
});
const adminSession = await createSessionService(h.prisma).issue({
  userId: adminUser.id,
  scope: 'ADMIN',
});
// Never commit the session fixture. Browser imports this private file only.
await writeFile(
  '/tmp/dd-cert-browser-private.json',
  JSON.stringify({
    adminCookie: adminSession.token,
    dealerA: a.dealerId,
    dealerB: b.dealerId,
    staffMembership: staffMembership.id,
    managerMembership: managerMembership.id,
    car,
    other,
    other2,
    other3,
  }),
);
await mkdir(new URL('./evidence/security/', import.meta.url), { recursive: true });
await writeFile(
  new URL('./evidence/security/api-probes.json', import.meta.url),
  JSON.stringify(results, null, 2) + '\n',
);
await h.close();
