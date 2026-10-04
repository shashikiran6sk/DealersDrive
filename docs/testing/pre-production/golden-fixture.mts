import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createAuthHarness } from '../../../apps/api/tests/auth-harness.js';
import { createSessionService } from '../../../apps/api/src/modules/auth/session.service.js';
import { createApprovalKit } from '../../../apps/api/tests/approval-kit.js';
import { createLocalStorage } from '../../../apps/api/src/platform/storage/local.adapter.js';
import { env } from '../../../apps/api/src/config/env.js';
import { ListingCheckKey } from '../../../packages/contracts/dist/index.js';
import { seedImages } from '../../../apps/api/tests/images-kit.js';
assert.equal(new URL(env.DATABASE_URL).hostname, 'localhost');
assert.equal(new URL(env.DATABASE_URL).pathname, '/dealersdrive_cert');
const h = await createAuthHarness();
const fixture = JSON.parse(await readFile('/tmp/dd-cert-browser-private.json', 'utf8'));
const roles = JSON.parse(await readFile('/tmp/dd-cert-role-browser-private.json', 'utf8'));
const ownerUser = await h.prisma.user.findFirstOrThrow({
  where: { phone: { endsWith: '9000081010' } },
});
const owner = h.agent();
owner.jar.setCookie(`dd_session=${roles.OWNER.token}`);
const admin = h.agent();
admin.jar.setCookie(`dd_session=${fixture.adminCookie}`);
let car;
const existing = await h.prisma.vehicle.findFirst({
  where: { registrationNumber: 'TN22QA8196' },
  include: { listing: true },
});
if (existing?.listing) {
  for (const key of ListingCheckKey.options)
    await admin
      .put(`/v1/admin/listings/${existing.listing.id}/checks/${key}`)
      .send({ checked: true })
      .expect(200);
  const mediaIds = await seedImages(
    h.prisma,
    { vehicleId: existing.id, dealerId: fixture.dealerA },
    6,
  );
  await admin.post(`/v1/admin/listings/${existing.listing.id}/approve`).expect(200);
  const listing = await h.prisma.listing.findUniqueOrThrow({ where: { id: existing.listing.id } });
  car = { listingId: listing.id, vehicleId: existing.id, mediaIds, slug: listing.slug };
} else {
  car = await createApprovalKit(h, admin).published(
    { agent: owner, dealerId: fixture.dealerA, userId: ownerUser.id, slug: '' },
    'TN22QA8196',
  );
}
const sharp = createRequire(new URL('../../../apps/api/package.json', import.meta.url))('sharp');
for (const id of car.mediaIds) {
  const media = await h.prisma.media.findUniqueOrThrow({ where: { id } });
  await createLocalStorage().put(
    media.storageKey,
    await sharp({ create: { width: 1024, height: 640, channels: 3, background: '#668899' } })
      .jpeg()
      .toBuffer(),
  );
}
const buyer = await h.prisma.user.findFirstOrThrow({
  where: { phone: { endsWith: '9000081001' } },
});
const session = await createSessionService(h.prisma).issue({ userId: buyer.id, scope: 'CUSTOMER' });
await writeFile(
  '/tmp/dd-cert-golden-private.json',
  JSON.stringify({ car, buyerToken: session.token }),
  { mode: 0o600 },
);
console.log('Published isolated browser journey fixture through actual moderation endpoints.');
await h.close();
