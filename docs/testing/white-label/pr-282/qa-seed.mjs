import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repo = process.argv[2];
if (!repo) throw new Error('Pass the repository root.');
const require = createRequire(resolve(repo, 'apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const sharp = require('sharp');
const url = 'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_white_label_qa';
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.replace('dealersdrive_white_label_qa', 'dealersdrive') }) });
const exists = await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname='dealersdrive_white_label_qa'`;
if (!exists.length) await admin.$executeRawUnsafe('CREATE DATABASE dealersdrive_white_label_qa');
await admin.$disconnect();
if (process.argv[3] === 'create-only') process.exit(0);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const storage = '/private/tmp/white-label-qa-storage';
const photo = await readFile(resolve(repo, 'apps/web/public/images/home-hero.webp'));
const carPhoto = await readFile(resolve(repo, 'apps/api/tests/fixtures/media/browser-car.webp'));
for (const [index, name] of ['alpha', 'beta'].entries()) {
  const slug = `qa-white-label-${name}`;
  const owner = await db.user.upsert({ where: { email: `${name}.website-qa@example.com` }, create: { fullName: `Synthetic ${name} owner`, email: `${name}.website-qa@example.com`, phone: `+91984001100${index + 1}`, phoneVerifiedAt: new Date() }, update: {} });
  const dealer = await db.dealer.upsert({ where: { slug }, create: { slug, brandName: `${name === 'alpha' ? 'Alpha' : 'Beta'} Motors (Test)`, legalName: `${name} Synthetic Motors`, city: 'Vellore', state: 'Tamil Nadu', addressLine: 'Synthetic test yard, not a real dealership', status: 'ACTIVE', approvedAt: new Date(), contactPhone: `+91984001100${index + 1}`, members: { create: { userId: owner.id, role: 'OWNER', permissions: [] } } }, update: {} });
  const mediaId = randomUUID();
  const variants = {};
  for (const width of [320, 640, 1024, 1600]) {
    const key = `qa/${mediaId}/${width}.webp`;
    await mkdir(resolve(storage, `qa/${mediaId}`), { recursive: true });
    await writeFile(resolve(storage, key), await sharp(photo).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
    variants[String(width)] = key;
  }
  const hero = await db.media.create({ data: { id: mediaId, dealerId: dealer.id, ownerType: 'DEALER_COVER', storageKey: variants['1600'], mimeType: 'image/webp', bytes: photo.length, variants, status: 'READY', warnings: [] } });
  const site = await db.dealerStorefront.upsert({ where: { dealerId: dealer.id }, create: { dealerId: dealer.id, subdomain: `qa-${name}`, displayName: dealer.brandName, theme: index === 0 ? 'LIGHT' : 'DARK', status: 'ACTIVE', headline: index === 0 ? 'A car for your next chapter.' : 'A different drive. A new beginning.', description: 'Synthetic preview inventory — not real listings. Explore the shared dealer website experience.', about: 'This is an isolated test dealership using synthetic accounts and inventory. The showroom image is the repository’s existing stock test presentation asset.', heroMediaId: hero.id, accentColor: index === 0 ? '#155e75' : '#d2a74c', contactPhone: dealer.contactPhone, whatsappPhone: dealer.contactPhone, mapsUrl: 'https://www.google.com/maps?q=Vellore', domains: { create: { hostname: `qa-${name}.dealers-drive.com`, kind: 'DEFAULT', status: 'ACTIVE', isPrimary: true, verifiedAt: new Date(), checkedAt: new Date(), certificateReady: true } } }, update: { heroMediaId: hero.id } });
  for (let car = 0; car < 6; car += 1) {
    const registration = `TN99Q${index}${1000 + car}`;
    const existing = await db.vehicle.findFirst({ where: { dealerId: dealer.id, registrationNumber: registration } });
    if (existing) continue;
    const vehicle = await db.vehicle.create({ data: { dealerId: dealer.id, registrationNumber: registration, make: index === 0 ? 'Honda' : 'Kia', model: index === 0 ? ['City', 'Jazz', 'Amaze'][car % 3] : ['Seltos', 'Sonet', 'Carens'][car % 3], variant: 'Synthetic test car', manufacturingYear: 2023 - car % 3, fuelType: 'PETROL', transmission: car % 2 ? 'AUTOMATIC' : 'MANUAL', kilometersDriven: 15000 + car * 5000, pricePaise: BigInt(65000000 + car * 5000000), description: 'Synthetic test listing. Image is clearly labelled isolated UAT fixture.', listing: { create: { dealerId: dealer.id, slug: `qa-${name}-car-${car + 1}`, status: car === 5 ? 'RESERVED' : 'ACTIVE', publishedAt: new Date() } } } });
    const id = randomUUID();
    const key = `qa/${id}/car.webp`;
    await mkdir(resolve(storage, `qa/${id}`), { recursive: true });
    await writeFile(resolve(storage, key), carPhoto);
    const image = await db.media.create({ data: { id, dealerId: dealer.id, ownerType: 'VEHICLE', storageKey: key, mimeType: 'image/webp', bytes: carPhoto.length, variants: Object.fromEntries([320, 640, 1024, 1600].map((width) => [String(width), key])), status: 'READY', uploadedByAdmin: true, warnings: [] } });
    await db.vehicleMedia.create({ data: { vehicleId: vehicle.id, mediaId: image.id, isPrimary: true, position: 0, addedBy: owner.id } });
  }
  process.stdout.write(JSON.stringify({ dealer: slug, hostname: site.subdomain + '.dealers-drive.com', theme: site.theme, synthetic: true }) + '\n');
}
await db.$disconnect();
