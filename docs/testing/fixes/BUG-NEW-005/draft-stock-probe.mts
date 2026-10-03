import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { env } from '../../../../apps/api/src/config/env.js';
import { createAuthHarness, createFakeGoogle } from '../../../../apps/api/tests/auth-harness.js';
import { createLocalStorage } from '../../../../apps/api/src/platform/storage/local.adapter.js';
import { documentKey } from '../../../../apps/api/src/modules/dealers/dealers.facade.js';
import {
  marketplaceFixtures,
  COMPLETE_VEHICLE,
} from '../../../../apps/api/tests/marketplace-fixtures.js';
assert.equal(env.NODE_ENV, 'test');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
assert.equal(env.STORAGE_DRIVER, 'local');
assert.equal(env.JOBS_ENABLED, false);
const h = await createAuthHarness(createFakeGoogle());
try {
  const dealer = await h.prisma.dealer.findFirstOrThrow({
    where: {
      slug: { startsWith: 'new005-browser-' },
      status: 'PENDING_APPROVAL',
      approvedAt: null,
    },
    include: {
      documents: true,
      members: {
        where: { role: 'OWNER', status: 'ACTIVE' },
        include: { user: { include: { identities: true } } },
      },
    },
  });
  const owner = dealer.members[0]?.user;
  assert.ok(owner?.email);
  const identity = owner.identities.find((row) => row.provider === 'GOOGLE');
  assert.ok(identity);
  h.google.claims = {
    subject: identity.providerSubject,
    email: owner.email,
    emailVerified: true,
    name: owner.fullName ?? 'Fixture Owner',
  };
  const agent = h.agent();
  await h.signIn(agent);
  const vehicle = await agent
    .post('/v1/dealer/vehicles')
    .send({ registrationNumber: 'KL41RP9981' })
    .expect(201);
  await agent.patch(`/v1/dealer/vehicles/${vehicle.body.id}`).send(COMPLETE_VEHICLE).expect(200);
  await agent.post(`/v1/dealer/vehicles/${vehicle.body.id}/submit`).expect(403);
  const listing = await h.prisma.listing.findFirstOrThrow({
    where: { vehicleId: vehicle.body.id },
  });
  assert.equal(listing.status, 'DRAFT');
  const media = await h.prisma.media.findMany({ where: { dealerId: dealer.id } });
  const keys = [
    ...dealer.documents.map((doc) => documentKey(dealer.slug, doc.type, doc.id)),
    ...media.map((row) => row.storageKey),
  ];
  const storage = createLocalStorage();
  assert.equal((await Promise.all(keys.map((key) => storage.head(key)))).filter(Boolean).length, 4);
  const admin = await marketplaceFixtures(h, 'new005-stock').moderator();
  const response = await admin
    .post(`/v1/admin/dealers/${dealer.id}/reject`)
    .send({ reason: 'Invalid supporting documents' })
    .expect(200);
  assert.equal(response.body.objectsDeleted, 4);
  assert.equal(await h.prisma.vehicle.count({ where: { dealerId: dealer.id } }), 0);
  assert.equal(await h.prisma.listing.count({ where: { dealerId: dealer.id } }), 0);
  assert.equal(await h.prisma.dealerMember.count({ where: { dealerId: dealer.id } }), 0);
  assert.equal(await h.prisma.media.count({ where: { dealerId: dealer.id } }), 0);
  assert.equal((await Promise.all(keys.map((key) => storage.head(key)))).filter(Boolean).length, 0);
  assert.ok(await h.prisma.user.findUnique({ where: { id: owner.id } }));
  assert.equal(
    await h.prisma.auditLog.count({ where: { dealerId: dealer.id, action: 'vehicle.created' } }),
    1,
  );
  assert.equal(
    await h.prisma.auditLog.count({ where: { dealerId: dealer.id, action: 'dealer.rejected' } }),
    1,
  );
  const result = {
    sourceSha: process.env.TESTED_SHA,
    scenario: 'Unapproved applicant with prepared DRAFT stock',
    result: 'PASS',
    before: { dealer: 'PENDING_APPROVAL', listing: 'DRAFT', uploadedObjects: 4, submitHttp: 403 },
    after: {
      rejectHttp: 200,
      vehicles: 0,
      listings: 0,
      memberships: 0,
      media: 0,
      uploadedObjects: 0,
      userPreserved: true,
      vehicleAuditPreserved: true,
      rejectionAudit: 1,
    },
    providers: 'Fake OAuth and recording mailer; isolated local database/storage',
  };
  await writeFile(
    new URL('./draft-stock.json', import.meta.url),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify({ scenario: result.scenario, result: result.result }));
} finally {
  await h.close();
}
