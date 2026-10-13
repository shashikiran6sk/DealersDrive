import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

import { env } from '../../../../apps/api/src/config/env.js';
import { hashToken } from '../../../../apps/api/src/modules/auth/session.service.js';
import { createPrisma } from '../../../../apps/api/src/platform/db/prisma.js';

assert.equal(env.NODE_ENV, 'test');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname));
const fixture = JSON.parse(await readFile('/tmp/dd-bug008-browser-private.json', 'utf8'));
const prisma = createPrisma();
const afterGolden = process.argv[2] === 'golden';
try {
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { id: fixture.enquiryId },
    select: {
      id: true,
      dealerId: true,
      customerId: true,
      listingId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      contactedAt: true,
      closedAt: true,
      contactedById: true,
      closedById: true,
    },
  });
  const enquiryHistory = await prisma.auditLog.findMany({
    where: { entityId: enquiry.id, action: { in: ['enquiry.contacted', 'enquiry.closed'] } },
    orderBy: { createdAt: 'asc' },
    select: { action: true, actorType: true, actorId: true, dealerId: true, createdAt: true },
  });
  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: enquiry.listingId },
    select: {
      id: true,
      vehicleId: true,
      dealerId: true,
      status: true,
      publishedAt: true,
      decidedBy: true,
    },
  });
  assert.equal(enquiry.status, afterGolden ? 'CLOSED' : 'NEW');
  if (!afterGolden) assert.equal(enquiry.createdAt.toISOString(), enquiry.updatedAt.toISOString());
  assert.equal(enquiry.dealerId, fixture.dealerId);
  assert.equal(enquiry.customerId, fixture.customerId);
  if (afterGolden) {
    const ownerSession = await prisma.session.findFirstOrThrow({
      where: { tokenHash: hashToken(fixture.ownerToken) },
      select: { userId: true },
    });
    assert.equal(enquiry.closedById, ownerSession.userId);
    assert.deepEqual(
      enquiryHistory.slice(-2).map((row) => row.action),
      ['enquiry.contacted', 'enquiry.closed'],
    );
    assert.ok(
      enquiryHistory.every(
        (row) =>
          row.actorType === 'DEALER' &&
          row.actorId === ownerSession.userId &&
          row.dealerId === fixture.dealerId,
      ),
    );
    assert.equal(enquiry.contactedById, ownerSession.userId);
    assert.ok(enquiry.contactedAt && enquiry.closedAt && enquiry.closedAt >= enquiry.contactedAt);
  } else {
    assert.equal(enquiry.closedById, null);
    assert.equal(enquiry.contactedById, null);
  }
  assert.equal(listing.vehicleId, fixture.car.vehicleId);
  assert.equal(listing.dealerId, fixture.dealerId);
  assert.equal(listing.status, 'ACTIVE');
  assert.equal(listing.decidedBy, fixture.adminUserId);
  assert.ok(listing.publishedAt);
  const savedCount = await prisma.savedVehicle.count({
    where: { customerId: fixture.customerId, listingId: listing.id },
  });
  assert.equal(savedCount, 1);
  const operator = await prisma.user.findUniqueOrThrow({
    where: { id: fixture.longOperatorId },
    select: { id: true, isPlatformAdmin: true, adminRole: true },
  });
  assert.equal(operator.isPlatformAdmin, false);
  assert.equal(operator.adminRole, null);
  const seats = await prisma.userRole.count({ where: { userId: operator.id, role: 'ADMIN' } });
  assert.equal(seats, 0);
  const sessions = [];
  for (const [label, token] of [
    ['revokedGrantedAdmin', fixture.longAdminToken],
    ['loggedOutAdmin', fixture.logoutAdminToken],
    ['expiredAdmin', fixture.expiredAdminToken],
  ]) {
    const session = await prisma.session.findFirstOrThrow({
      where: { tokenHash: hashToken(token) },
      select: { scope: true, userId: true, expiresAt: true, revokedAt: true },
    });
    if (label === 'expiredAdmin') assert.ok(session.expiresAt < new Date());
    else assert.ok(session.revokedAt);
    sessions.push({ label, ...session });
  }
  const audits = await prisma.auditLog.findMany({
    where: {
      entityId: operator.id,
      action: { in: ['admin.access.granted', 'admin.access.revoked'] },
    },
    select: { action: true, actorType: true, actorId: true, createdAt: true },
  });
  assert.ok(audits.some((row) => row.action === 'admin.access.granted'));
  assert.ok(audits.some((row) => row.action === 'admin.access.revoked'));
  assert.ok(
    audits.every((row) => row.actorType === 'ADMIN' && row.actorId === fixture.adminUserId),
  );
  const foreignKeys = await prisma.$queryRaw<
    { total: number; unvalidated: number }[]
  >`SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT convalidated)::int AS unvalidated FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`;
  assert.equal(foreignKeys[0].unvalidated, 0);
  const report = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    result: 'PASS',
    enquiry,
    enquiryHistory,
    listing,
    savedCount,
    operator,
    adminSeats: seats,
    sessions,
    audits,
    foreignKeys,
    scope: afterGolden
      ? 'Fresh-authority golden contact/close: actor history and timestamps verified; listing and Saved rows retained; does not certify queued revocation race'
      : 'Read-only resource preservation after Admin layout UAT; expected test grant/revoke/logout mutations verified with actors and timestamps; no credentials/PII',
  };
  await writeFile(
    new URL(
      afterGolden ? 'evidence/stack-golden-database.json' : 'evidence/database-verification.json',
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    afterGolden
      ? 'Golden CLOSED enquiry, contact/close actor timestamps, preserved ACTIVE listing/Saved row and foreign keys PASS.'
      : 'Database ownership, unchanged NEW enquiry/ACTIVE listing/Saved row, revocation/logout/expiry, audit actors and foreign keys PASS.',
  );
} finally {
  await prisma.$disconnect();
}
