import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

import { env } from '../src/config/env.js';
import { createPrisma } from '../src/platform/db/prisma.js';
import { writeDerivatives } from '../src/platform/media/derivatives.js';
import { createLocalStorage } from '../src/platform/storage/local.adapter.js';

const target = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== 'test' || target.pathname !== '/dealersdrive_test' || !['localhost', '127.0.0.1'].includes(target.hostname) || env.STORAGE_DRIVER !== 'local') {
  throw new Error('Fixture requires NODE_ENV=test and localhost/dealersdrive_test with local storage.');
}
const prisma = createPrisma();
const storage = createLocalStorage();
try {
  const listing = await prisma.listing.findFirstOrThrow({ where: { status: 'ACTIVE', slug: { not: null }, dealer: { status: 'ACTIVE' }, vehicle: { images: { none: {} } } }, orderBy: { publishedAt: 'desc' } });
  const user = await prisma.user.findFirstOrThrow();
  const original = await sharp(await readFile('../web/public/images/home-hero.webp')).resize({ width: 4096 }).jpeg({ quality: 95 }).toBuffer();
  const mediaIds = [];
  for (let index = 0; index < 6; index += 1) {
    const id = crypto.randomUUID();
    const key = `vehicles/${listing.vehicleId}/${id}/original.jpg`;
    await storage.put(key, original, 'image/jpeg');
    const variants = await writeDerivatives(id, original, storage);
    await prisma.media.create({ data: { id, dealerId: listing.dealerId, ownerType: 'VEHICLE', storageKey: key, mimeType: 'image/jpeg', bytes: original.length, status: 'READY', variants } });
    await prisma.vehicleMedia.create({ data: { vehicleId: listing.vehicleId, mediaId: id, position: index, isPrimary: index === 0, addedBy: user.id } });
    mediaIds.push(id);
  }
  const cover = crypto.randomUUID();
  const coverKey = `dealers/validation/yard/${cover}`;
  await storage.put(coverKey, original, 'image/jpeg');
  const variants = await writeDerivatives(cover, original, storage);
  await prisma.media.create({ data: { id: cover, dealerId: listing.dealerId, ownerType: 'DEALER_COVER', storageKey: coverKey, mimeType: 'image/jpeg', bytes: original.length, status: 'READY', variants } });
  const dealer = await prisma.dealer.update({ where: { id: listing.dealerId }, data: { coverMediaId: cover } });
  await prisma.listing.update({ where: { id: listing.id }, data: { publishedAt: new Date() } });
  process.stdout.write(JSON.stringify({ car: listing.slug, dealer: dealer.slug, mediaIds, originalBytes: original.length }) + '\n');
} finally {
  await prisma.$disconnect();
}
