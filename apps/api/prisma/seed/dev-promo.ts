import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { slugify } from '@dealers-drive/contracts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

import { env } from '../../src/config/env.js';
import { yardPhotoKey } from '../../src/modules/dealers/dealer-storage-keys.js';
import { vehicleImageKey } from '../../src/modules/vehicle-images/vehicle-images.service.js';
import { DERIVATIVE_WIDTHS } from '../../src/platform/media/urls.js';
import { createStorage } from '../../src/platform/storage/factory.js';
import { assertLocalDatabase } from './dev-guard.js';
import {
  PROMO_APPLICANT,
  PROMO_APPLICANT_YARD_KEY,
  PROMO_CUSTOMERS,
  PROMO_DEALER_GSTIN,
  PROMO_ENQUIRIES,
  PROMO_FILM_CUSTOMER,
  PROMO_PUBLISHED_ANCHOR,
  PROMO_VEHICLES,
  type PromoCustomer,
  type PromoVehicle,
} from './dev-promo.data.js';
import { devUuid } from './dev-vehicles.data.js';

/**
 * Prepares the promotional demo: the rows in `dev-promo.data.ts`, a catalogue
 * for the art generator, and — once the generator has run — the photographs.
 *
 *     pnpm --filter @dealers-drive/api db:seed:promo
 *     pnpm --filter @dealers-drive/api db:seed:promo --catalog-only
 *     pnpm --filter @dealers-drive/api db:seed:promo --refresh-media
 *
 * `marketing/dealers-drive-promo/scripts/prepare-demo.sh` runs the three steps
 * in order; see that folder's README for the whole pipeline.
 *
 * ── Three steps, because the art needs the rows ─────────────────────────────
 *   1. Rows. Green Circle's extra cars, the demo customers and enquiries, and
 *      the onboarding applicant — upserted by deterministic id, so a re-run
 *      resets them to exactly the state the film starts from.
 *   2. Catalogue. Every car the marketplace shows, and every dealership, with
 *      what the generator needs to draw it: body, colour, make, dealership.
 *      Written to `<assets>/catalog.json`.
 *   3. Photographs. If `<assets>/generated/manifest.json` exists, each car's
 *      gallery and each dealership's yard photograph is written through the
 *      storage port — the same `StoragePort` and the same object keys the
 *      upload flows use — with `Media` and `VehicleMedia` rows beside it.
 *      A photograph already in place is left alone, so resetting the demo
 *      between takes costs seconds; `--refresh-media` re-encodes everything
 *      after the art has been regenerated.
 *
 * ── It never overwrites a real upload ───────────────────────────────────────
 * Every row this writes carries `fileName` starting `promo/`. A car or a
 * dealership that already has a photograph without that prefix — one a
 * person uploaded through the admin console or onboarding — is skipped, and
 * a re-run replaces only its own rows.
 *
 * ── Local only ──────────────────────────────────────────────────────────────
 * Guarded by `assertLocalDatabase`, like the other dev seeds, and it refuses
 * `NODE_ENV=production` outright. Nothing in `src` imports it.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const storage = createStorage();

const PROMO_PREFIX = 'promo/';
const refreshMedia = process.argv.includes('--refresh-media');

type Outcome = 'attached' | 'unchanged' | 'skipped' | 'missing';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const assetsDir = (() => {
  const configured = process.env.PROMO_ASSETS_DIR ?? '../../marketing/dealers-drive-promo/assets';
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
})();

interface ManifestShot {
  shot: string;
  label: string;
  file: string;
}

interface Manifest {
  vehicles: Record<string, ManifestShot[] | undefined>;
  yards: Record<string, { file: string } | undefined>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseManifest(raw: unknown): Manifest {
  if (!isRecord(raw) || !isRecord(raw.vehicles) || !isRecord(raw.yards)) {
    throw new Error('The promo manifest is not in the expected shape — re-run the generator.');
  }
  const vehicles: Manifest['vehicles'] = {};
  for (const [id, shots] of Object.entries(raw.vehicles)) {
    if (!Array.isArray(shots)) continue;
    vehicles[id] = shots.flatMap((shot: unknown) =>
      isRecord(shot) &&
      typeof shot.shot === 'string' &&
      typeof shot.label === 'string' &&
      typeof shot.file === 'string'
        ? [{ shot: shot.shot, label: shot.label, file: shot.file }]
        : [],
    );
  }
  const yards: Manifest['yards'] = {};
  for (const [key, yard] of Object.entries(raw.yards)) {
    if (isRecord(yard) && typeof yard.file === 'string') yards[key] = { file: yard.file };
  }
  return { vehicles, yards };
}

async function promoDealer(): Promise<{ id: string; slug: string; ownerId: string }> {
  const dealer = await prisma.dealer.findUnique({
    where: { gstin: PROMO_DEALER_GSTIN },
    include: { members: { where: { role: 'OWNER' } } },
  });
  const ownerId = dealer?.members[0]?.userId;
  if (!dealer || !ownerId) {
    throw new Error(
      'Green Circle Cars is not in the database.\n' +
        'Seed the dev dealerships first: pnpm --filter @dealers-drive/api db:seed:dev',
    );
  }
  return { id: dealer.id, slug: dealer.slug, ownerId };
}

async function writePromoVehicle(
  car: PromoVehicle,
  dealer: { id: string; ownerId: string },
): Promise<void> {
  const id = devUuid(`promo-vehicle-${car.key}`);
  const listingId = devUuid(`promo-listing-${car.key}`);
  const submittedAt = new Date(
    PROMO_PUBLISHED_ANCHOR.getTime() - (car.daysBeforeAnchor + 2) * DAY_MS,
  );
  const publishedAt = new Date(PROMO_PUBLISHED_ANCHOR.getTime() - car.daysBeforeAnchor * DAY_MS);
  const isLive = ['ACTIVE', 'RESERVED', 'SOLD', 'WITHDRAWN'].includes(car.status);
  const released = car.status === 'SOLD';

  const vehicle = {
    dealerId: dealer.id,
    registrationNumber: car.registrationNumber,
    rtoCode: car.registrationNumber.slice(0, 4),
    make: car.make,
    model: car.model,
    variant: car.variant,
    manufacturingYear: car.year,
    registrationYear: car.year,
    fuelType: car.fuelType,
    transmission: car.transmission,
    bodyType: car.bodyType,
    kilometersDriven: car.kilometersDriven,
    ownerCount: car.ownerCount,
    color: car.color,
    insuranceType: 'COMPREHENSIVE' as const,
    pricePaise: BigInt(car.priceRupees) * 100n,
    negotiability: 'SLIGHTLY' as const,
    description: car.description,
    claimedAt: submittedAt,
    releasedAt: released ? publishedAt : null,
    createdBy: dealer.ownerId,
  };

  const listing = {
    dealerId: dealer.id,
    status: car.status,
    submittedAt,
    lastSubmittedAt: submittedAt,
    submissionCount: 1,
    publishedAt: isLive ? publishedAt : null,
    slug: isLive
      ? `${slugify(`${String(car.year)} ${car.make} ${car.model} ${car.variant} Vellore`)}-${id.slice(0, 8)}`
      : null,
    reservedAt: car.status === 'RESERVED' ? new Date(publishedAt.getTime() + DAY_MS) : null,
    soldAt: car.status === 'SOLD' ? new Date(publishedAt.getTime() + 3 * DAY_MS) : null,
    withdrawnAt: car.status === 'WITHDRAWN' ? new Date(publishedAt.getTime() + 2 * DAY_MS) : null,
    withdrawalReason: car.withdrawalReason ?? null,
    withdrawalNote: null,
    decisionReason: null,
    decidedAt: isLive ? publishedAt : null,
  };

  await prisma.$transaction([
    prisma.vehicle.upsert({ where: { id }, update: vehicle, create: { id, ...vehicle } }),
    prisma.listing.upsert({
      where: { id: listingId },
      update: listing,
      create: { id: listingId, vehicleId: id, ...listing },
    }),
  ]);
}

async function upsertCustomer(customer: PromoCustomer): Promise<string> {
  const user = await prisma.user.upsert({
    where: { phone: customer.phone },
    update: {
      fullName: customer.fullName,
      phoneVerifiedAt: PROMO_PUBLISHED_ANCHOR,
      status: 'ACTIVE',
    },
    create: {
      fullName: customer.fullName,
      phone: customer.phone,
      phoneVerifiedAt: PROMO_PUBLISHED_ANCHOR,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: 'CUSTOMER' } },
    update: { status: 'ACTIVE', suspendedAt: null, reason: null },
    create: { userId: user.id, role: 'CUSTOMER' },
  });
  return user.id;
}

async function listingIdFor(dealerId: string, vehicle: string): Promise<string> {
  if (!vehicle.startsWith('dev:')) return devUuid(`promo-listing-${vehicle}`);
  const model = vehicle.slice('dev:'.length);
  const row = await prisma.listing.findFirst({
    where: { dealerId, status: 'ACTIVE', vehicle: { model } },
    orderBy: { publishedAt: 'desc' },
  });
  if (!row) throw new Error(`Green Circle has no active ${model} — has the dev seed changed?`);
  return row.id;
}

async function seedEnquiries(dealerId: string): Promise<void> {
  const customers = new Map<string, string>();
  for (const customer of PROMO_CUSTOMERS)
    customers.set(customer.key, await upsertCustomer(customer));

  const now = Date.now();
  for (const enquiry of PROMO_ENQUIRIES) {
    const customerId = customers.get(enquiry.customer);
    if (!customerId) throw new Error(`Unknown promo customer ${enquiry.customer}.`);
    const createdAt = new Date(now - enquiry.hoursAgo * HOUR_MS);
    const row = {
      customerId,
      dealerId,
      listingId: await listingIdFor(dealerId, enquiry.vehicle),
      message: enquiry.message,
      status: enquiry.status,
      contactedAt: enquiry.status === 'NEW' ? null : new Date(createdAt.getTime() + 2 * HOUR_MS),
      closedAt: enquiry.status === 'CLOSED' ? new Date(createdAt.getTime() + DAY_MS) : null,
      createdAt,
    };
    const id = devUuid(`promo-enquiry-${enquiry.key}`);
    await prisma.enquiry.upsert({ where: { id }, update: row, create: { id, ...row } });
  }
}

async function resetFilmCustomer(): Promise<void> {
  const userId = await upsertCustomer(PROMO_FILM_CUSTOMER);
  await prisma.enquiry.deleteMany({ where: { customerId: userId } });
  await prisma.savedVehicle.deleteMany({ where: { customerId: userId } });
  await prisma.session.deleteMany({ where: { userId } });
}

async function resetApplicant(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { phone: PROMO_APPLICANT.phone },
    update: { fullName: null, email: PROMO_APPLICANT.email, status: 'ACTIVE' },
    create: {
      phone: PROMO_APPLICANT.phone,
      phoneVerifiedAt: PROMO_PUBLISHED_ANCHOR,
      email: PROMO_APPLICANT.email,
      emailVerifiedAt: PROMO_PUBLISHED_ANCHOR,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: 'DEALER' } },
    update: { status: 'ACTIVE', suspendedAt: null, reason: null },
    create: { userId: user.id, role: 'DEALER' },
  });
  await prisma.oAuthIdentity.upsert({
    where: {
      provider_providerSubject: {
        provider: 'GOOGLE',
        providerSubject: PROMO_APPLICANT.googleSubject,
      },
    },
    update: {
      userId: user.id,
      email: PROMO_APPLICANT.email,
      displayName: PROMO_APPLICANT.fullName,
    },
    create: {
      userId: user.id,
      provider: 'GOOGLE',
      providerSubject: PROMO_APPLICANT.googleSubject,
      email: PROMO_APPLICANT.email,
      emailVerified: true,
      displayName: PROMO_APPLICANT.fullName,
    },
  });

  const memberships = await prisma.dealerMember.findMany({ where: { userId: user.id } });
  const dealerIds = memberships.map((member) => member.dealerId);
  if (dealerIds.length > 0) {
    const media = await prisma.media.findMany({ where: { dealerId: { in: dealerIds } } });
    await prisma.dealer.deleteMany({ where: { id: { in: dealerIds } } });
    await prisma.media.deleteMany({ where: { id: { in: media.map((row) => row.id) } } });
    await Promise.all(media.map((row) => storage.delete(row.storageKey)));
  }
  await prisma.session.deleteMany({ where: { userId: user.id } });
}

async function writeCatalog(featuredDealerId: string): Promise<void> {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { listing: { status: { in: ['ACTIVE', 'RESERVED'] } } },
        { dealerId: featuredDealerId, listing: { status: { not: 'DRAFT' } } },
      ],
    },
    include: { listing: true, dealer: { select: { slug: true, state: true } } },
    orderBy: { id: 'asc' },
  });
  const dealers = await prisma.dealer.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true, brandName: true, city: true, state: true, id: true },
    orderBy: { slug: 'asc' },
  });

  const catalog = {
    generatedBy: 'apps/api/prisma/seed/dev-promo.ts',
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      title:
        `${String(vehicle.manufacturingYear ?? '')} ${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.variant ?? ''}`.trim(),
      make: vehicle.make,
      model: vehicle.model,
      body: vehicle.bodyType,
      color: vehicle.color,
      pricePaise: Number(vehicle.pricePaise ?? 0n),
      budget: Number(vehicle.pricePaise ?? 0n) < 50_000_000,
      status: vehicle.listing?.status ?? null,
      listingSlug: vehicle.listing?.slug ?? null,
      dealerSlug: vehicle.dealer.slug,
      state: vehicle.dealer.state,
      tier: vehicle.dealerId === featuredDealerId ? 'featured' : 'standard',
    })),
    yards: [
      ...dealers.map((dealer) => ({
        key: dealer.slug,
        name: dealer.brandName,
        city: dealer.city,
        state: dealer.state,
        featured: dealer.id === featuredDealerId,
      })),
      {
        key: PROMO_APPLICANT_YARD_KEY,
        name: 'Metro Motors',
        city: 'Vellore',
        state: 'Tamil Nadu',
        featured: true,
      },
    ],
  };

  const path = resolve(assetsDir, 'catalog.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(
    `  Catalogue: ${String(catalog.vehicles.length)} cars, ${String(catalog.yards.length)} yards → ${path}`,
  );
}

async function webp(
  input: Buffer,
  width?: number,
): Promise<{ body: Buffer; width: number; height: number }> {
  const pipeline = sharp(input);
  const resized = width ? pipeline.resize({ width, withoutEnlargement: true }) : pipeline;
  const { data, info } = await resized.webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  return { body: data, width: info.width, height: info.height };
}

async function attachVehicle(
  vehicleId: string,
  shots: ManifestShot[],
  addedBy: string,
): Promise<Outcome> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return 'missing';
  const existing = await prisma.vehicleMedia.findMany({
    where: { vehicleId },
    include: { media: true },
  });
  if (existing.some((row) => !row.media.fileName?.startsWith(PROMO_PREFIX))) return 'skipped';

  const expected = shots.map((shot) => devUuid(`promo-media:${vehicleId}:${shot.shot}`));
  const current = [...existing].sort((a, b) => a.position - b.position).map((row) => row.mediaId);
  if (!refreshMedia && current.join() === expected.join()) {
    const heads = await Promise.all(existing.map((row) => storage.head(row.media.storageKey)));
    if (heads.every(Boolean)) return 'unchanged';
  }

  const rows = await Promise.all(
    shots.map(async (shot, position) => {
      const mediaId = expected[position] ?? devUuid(`promo-media:${vehicleId}:${shot.shot}`);
      const input = await readFile(resolve(assetsDir, 'generated', shot.file));
      const key = vehicleImageKey(vehicleId, mediaId, 'image/webp');
      const [original, ...derived] = await Promise.all([
        webp(input),
        ...DERIVATIVE_WIDTHS.map((width) => webp(input, width)),
      ]);
      if (!original) throw new Error(`Could not encode ${shot.file}.`);
      await storage.put(key, original.body, 'image/webp');
      const variants: Record<string, string> = {};
      for (const [index, width] of DERIVATIVE_WIDTHS.entries()) {
        const variant = derived[index];
        if (!variant) continue;
        const variantKey = key.replace(/original\.webp$/, `${String(width)}.webp`);
        await storage.put(variantKey, variant.body, 'image/webp');
        variants[String(width)] = variantKey;
      }
      return { mediaId, key, position, shot, original, variants };
    }),
  );

  const keep = new Set(rows.map((row) => row.mediaId));
  const stale = existing.filter((row) => !keep.has(row.mediaId));

  await prisma.$transaction([
    prisma.vehicleMedia.deleteMany({ where: { vehicleId } }),
    prisma.media.deleteMany({ where: { id: { in: existing.map((row) => row.mediaId) } } }),
    ...rows.flatMap((row) => [
      prisma.media.create({
        data: {
          id: row.mediaId,
          dealerId: vehicle.dealerId,
          ownerType: 'VEHICLE',
          storageKey: row.key,
          mimeType: 'image/webp',
          bytes: row.original.body.length,
          width: row.original.width,
          height: row.original.height,
          variants: row.variants,
          fileName: `${PROMO_PREFIX}${row.shot.shot}.webp`,
          uploadedByAdmin: true,
          status: 'READY',
        },
      }),
      prisma.vehicleMedia.create({
        data: {
          vehicleId,
          mediaId: row.mediaId,
          position: row.position,
          isPrimary: row.position === 0,
          addedBy,
        },
      }),
    ]),
    prisma.vehiclePhotography.upsert({
      where: { vehicleId },
      update: { status: 'READY' },
      create: { vehicleId, status: 'READY' },
    }),
  ]);
  await Promise.all(stale.map((row) => storage.delete(row.media.storageKey)));
  return 'attached';
}

async function attachYard(slug: string, file: string): Promise<Outcome> {
  const dealer = await prisma.dealer.findUnique({ where: { slug } });
  if (!dealer) return 'missing';
  const mediaId = devUuid(`promo-yard:${slug}`);
  const key = yardPhotoKey(slug, mediaId);
  if (dealer.coverMediaId) {
    const current = await prisma.media.findUnique({ where: { id: dealer.coverMediaId } });
    if (current && !current.fileName?.startsWith(PROMO_PREFIX)) return 'skipped';
    if (!refreshMedia && current?.id === mediaId && (await storage.head(key))) return 'unchanged';
  }

  const image = await webp(await readFile(resolve(assetsDir, 'generated', file)));
  await storage.put(key, image.body, 'image/webp');
  const media = {
    dealerId: dealer.id,
    ownerType: 'DEALER_COVER' as const,
    storageKey: key,
    mimeType: 'image/webp',
    bytes: image.body.length,
    width: image.width,
    height: image.height,
    fileName: `${PROMO_PREFIX}yard.webp`,
    status: 'READY' as const,
  };
  await prisma.media.upsert({
    where: { id: mediaId },
    update: media,
    create: { id: mediaId, ...media },
  });
  await prisma.dealer.update({ where: { id: dealer.id }, data: { coverMediaId: mediaId } });
  return 'attached';
}

async function attachPhotographs(): Promise<void> {
  const manifestPath = resolve(assetsDir, 'generated', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.log(
      `\n  No photographs yet — ${manifestPath} does not exist.\n` +
        '  Generate them, then run this again:\n' +
        '    cd marketing/dealers-drive-promo && npm run media',
    );
    return;
  }
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  const admin = await prisma.user.findFirst({
    where: { isPlatformAdmin: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin)
    throw new Error('No admin user to credit the photographs to — run pnpm db:seed first.');

  const tally: Record<Outcome, number> = { attached: 0, unchanged: 0, skipped: 0, missing: 0 };
  const queue = Object.entries(manifest.vehicles);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [vehicleId, shots] = next;
        if (!shots || shots.length === 0) continue;
        tally[await attachVehicle(vehicleId, shots, admin.id)] += 1;
      }
    }),
  );
  const yards: Record<Outcome, number> = { attached: 0, unchanged: 0, skipped: 0, missing: 0 };
  for (const [slug, yard] of Object.entries(manifest.yards)) {
    if (!yard) continue;
    yards[await attachYard(slug, yard.file)] += 1;
  }
  console.log(
    `  Cars photographed: ${String(tally.attached)} written, ${String(tally.unchanged)} unchanged (skipped ${String(tally.skipped)} with real uploads, ${String(tally.missing)} not in the database)`,
  );
  console.log(
    `  Yard photographs:  ${String(yards.attached)} written, ${String(yards.unchanged)} unchanged (skipped ${String(yards.skipped)} with real uploads, ${String(yards.missing)} without a dealership)`,
  );
}

async function main(): Promise<void> {
  assertLocalDatabase('promotional demo data');
  const catalogOnly = process.argv.includes('--catalog-only');

  const dealer = await promoDealer();
  for (const car of PROMO_VEHICLES) await writePromoVehicle(car, dealer);
  await seedEnquiries(dealer.id);
  await resetFilmCustomer();
  await resetApplicant();

  console.log('Promotional demo seed\n');
  console.log(`  Featured dealership: Green Circle Cars (${dealer.slug})`);
  console.log(
    `  Promo cars: ${String(PROMO_VEHICLES.length)} · enquiries: ${String(PROMO_ENQUIRIES.length)}`,
  );
  console.log(
    `  Film customer: ${PROMO_FILM_CUSTOMER.fullName} — enquiries and saved cars cleared`,
  );
  console.log(`  Onboarding applicant: ${PROMO_APPLICANT.fullName} — starts at step one`);

  await writeCatalog(dealer.id);
  if (!catalogOnly) await attachPhotographs();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
