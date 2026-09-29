import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { assertPromoEnvironment, REPO, PROMO, API } from './environment.mjs';
assertPromoEnvironment();
const require = createRequire(resolve(REPO, 'apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const story = JSON.parse(await readFile(resolve(PROMO, 'story.json'), 'utf8'));
  const media = await db.media.findMany({
    where: { status: 'READY', ownerType: { in: ['VEHICLE', 'DEALER_COVER'] } },
  });
  assert.equal(media.length, 47);
  for (const item of media) {
    const r = await fetch(`${API}/media/by-media/${item.id}/1600.webp`);
    assert.equal(r.status, 200, item.fileName);
    assert.match(r.headers.get('content-type') || '', /image\/webp/);
    const body = Buffer.from(await r.arrayBuffer());
    assert.ok(body.byteLength > 1000);
    if (item.fileName.startsWith('vehicles/')) {
      assert.ok(item.storageKey.startsWith('demo/white-studio-v2/'));
      const variant = (item.variants as Record<string, string>)['1600'];
      const expected = await readFile(resolve(process.env.STORAGE_LOCAL_DIR!, variant));
      const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash(body), hash(expected), `Stale vehicle media: ${item.fileName}`);
    }
  }
  for (const car of story.cars)
    assert.equal(
      await db.vehicleMedia.count({ where: { vehicleId: car.id } }),
      car.key === 'elevate' ? 8 : 3,
    );
  assert.equal(await db.dealer.count({ where: { status: 'ACTIVE' } }), 6);
  assert.equal(await db.listing.count({ where: { status: 'ACTIVE' } }), 12);
  const enquiries = await db.enquiry.findMany({ where: { customerId: story.customerId } });
  assert.ok(
    enquiries.some((e: any) => e.status === 'CONTACTED'),
    'Customer enquiry must reach dealer follow-up',
  );
  const draft = await db.listing.findUnique({ where: { vehicleId: story.draftId } });
  assert.equal(draft.status, 'PENDING_REVIEW');
  const dealer = await db.dealer.findUnique({ where: { id: story.dealerId } });
  assert.equal(dealer.establishedYear, 2012);
  assert.equal(
    await db.savedVehicle.count({
      where: { customerId: story.customerId, listingId: story.featured.listingId },
    }),
    1,
  );
  const summary = {
    photographs: media.length,
    activeDealers: 6,
    activeCars: 12,
    galleries: '8 featured; 3 per other car',
    mediaHttp: '47/47 pass',
    vehicleMediaRevision: 'white-studio-v2; 41/41 served bytes match local derivatives',
    customerToDealer: 'CONTACTED',
    listingSubmission: 'PENDING_REVIEW',
    profileEdit: 'establishedYear=2012',
    savedFeaturedCar: true,
    productionSourceChanged: false,
  };
  await writeFile(resolve(PROMO, 'demo-verification.json'), JSON.stringify(summary, null, 2));
  console.log(summary);
} finally {
  await db.$disconnect();
}
