import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEV_DEALERS } from '../../../apps/api/prisma/seed/dev-dealers.data.js';
import { generateDevVehicles, devUuid } from '../../../apps/api/prisma/seed/dev-vehicles.data.js';
import { assertPromoEnvironment, REPO, PROMO, API } from './environment.mjs';

assertPromoEnvironment();
const require = createRequire(resolve(REPO, 'apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const sharp = require('sharp');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const anchor = new Date('2026-09-29T06:00:00Z');
const specs = [
  [3, 'elevate'],
  [1, 'city'],
  [2, 'wagon'],
  [4, 'innova'],
  [7, 'brezza'],
  [8, 'tiago'],
  [11, 'thar'],
  [14, 'fortuner'],
  [16, 'nexon'],
  [17, 'hyryder'],
  [19, 'carens'],
  [23, 'kushaq'],
] as const;
const gallery = ['hero', 'rear', 'side', 'dashboard', 'front-seats', 'rear-seats', 'boot', 'wheel'];

async function media(relative: string, dealerId: string, ownerType: string) {
  const input = await readFile(resolve(PROMO, 'assets', relative));
  // Version replacement vehicle photography so image caches cannot serve the old setting.
  const revision = relative.startsWith('vehicles/')
    ? `white-studio-v2/${createHash('sha256').update(input).digest('hex').slice(0, 12)}/`
    : '';
  const id = devUuid(`promo-media:${revision}${relative}`);
  const metadata = await sharp(input).metadata();
  const base = `demo/${revision}${relative.replace(/\.png$/, '')}`;
  const storageKey = `${base}/original.png`;
  const variants: Record<string, string> = {};
  const root = process.env.STORAGE_LOCAL_DIR!;
  await mkdir(resolve(root, base), { recursive: true });
  await writeFile(resolve(root, storageKey), input);
  for (const width of [320, 640, 1024, 1600]) {
    const key = `${base}/${width}.webp`;
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(resolve(root, key));
    variants[String(width)] = key;
  }
  const data = {
    dealerId,
    ownerType,
    storageKey,
    mimeType: 'image/png',
    bytes: input.length,
    width: metadata.width,
    height: metadata.height,
    variants,
    fileName: relative,
    status: 'READY',
    warnings: [],
    uploadedByAdmin: true,
  };
  await db.media.upsert({ where: { id }, update: data, create: { id, ...data } });
  return id;
}

async function seed() {
  // Fail before touching rows if a required asset is absent.
  for (const [, key] of specs) {
    for (const view of key === 'elevate' ? gallery : ['hero', 'rear', 'dashboard'])
      await readFile(resolve(PROMO, `assets/vehicles/${key}/${view}.png`));
  }
  for (let i = 0; i < 6; i++) await readFile(resolve(PROMO, `assets/dealers/dealer-${i + 1}.png`));

  // Reset only this dedicated promotional DB. The strict guard has no override.
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE users, dealers, media, platform_config, audit_logs, cache_counter, cache_version, outbox_events RESTART IDENTITY CASCADE',
  );
  const dealerIds = new Map<string, string>();
  const ownerIds = new Map<string, string>();
  for (const [index, d] of DEV_DEALERS.slice(0, 6).entries()) {
    const id = devUuid(`promo-dealer:${d.gstin}`);
    const owner = devUuid(`promo-owner:${d.gstin}`);
    dealerIds.set(d.gstin, id);
    ownerIds.set(d.gstin, owner);
    const phone = `+91900000010${index}`;
    const email = `dealer${index + 1}@example.invalid`;
    await db.user.create({
      data: {
        id: owner,
        fullName: index === 0 ? 'Annamalai' : d.ownerName,
        email,
        phone,
        emailVerifiedAt: anchor,
        phoneVerifiedAt: anchor,
        roles: { create: { role: 'DEALER' } },
      },
    });
    await db.dealer.create({
      data: {
        id,
        slug: d.slug,
        brandName: d.brandName,
        legalName: d.legalName,
        tagline: 'Explore our multi-brand used-car inventory and arrange a visit to our yard.',
        gstin: d.gstin,
        pan: d.pan,
        status: 'ACTIVE',
        approvedAt: anchor,
        city: d.city,
        district: d.district,
        state: d.state,
        addressLine: '24, Demonstration Road',
        pincode: d.pincode,
        lat: d.lat,
        lng: d.lng,
        mapsUrl: d.mapsUrl,
        contactPhone: phone,
        contactEmail: email,
        workingHours: d.workingHours,
        establishedYear: d.establishedYear,
        specialities: ['Exchange', 'RC transfer', 'Finance assistance'],
        members: { create: { userId: owner, role: 'OWNER', permissions: [] } },
        documents: {
          create: ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'].map((type) => ({
            type,
            status: 'VERIFIED',
          })),
        },
        createdAt: new Date(anchor.getTime() - index * 86400000),
      },
    });
    const coverMediaId = await media(`dealers/dealer-${index + 1}.png`, id, 'DEALER_COVER');
    await db.dealer.update({ where: { id }, data: { coverMediaId } });
  }

  const all = generateDevVehicles(DEV_DEALERS);
  const storyCars = [];
  for (const [rank, [index, key]] of specs.entries()) {
    const c = all[index]!;
    const dealerId = dealerIds.get(c.dealerGstin)!;
    const car = {
      dealerId,
      registrationNumber: c.registrationNumber,
      rtoCode: c.rtoCode,
      make: c.make,
      model: c.model,
      variant: c.variant,
      manufacturingYear: c.manufacturingYear,
      registrationYear: c.registrationYear,
      fuelType: key === 'city' ? 'PETROL' : c.fuelType,
      transmission: ['innova', 'tiago'].includes(key)
        ? 'MANUAL'
        : key === 'kushaq'
          ? 'AUTOMATIC'
          : c.transmission,
      bodyType: c.bodyType,
      kilometersDriven: c.kilometersDriven,
      ownerCount: c.ownerCount,
      color: c.color,
      insuranceType: 'COMPREHENSIVE',
      insuranceValidUntil: new Date('2027-09-01'),
      pricePaise: c.pricePaise,
      negotiability: 'SLIGHTLY',
      description: `${c.make} ${c.model} ${c.variant}. Explore the photographs and specifications, then contact ${DEV_DEALERS.find((d) => d.gstin === c.dealerGstin)!.brandName} to arrange a viewing.`,
      claimedAt: c.claimedAt,
      createdAt: new Date(anchor.getTime() - rank * 60000),
    };
    await db.vehicle.create({ data: { id: c.id, ...car } });
    await db.listing.create({
      data: {
        id: c.listingId,
        vehicleId: c.id,
        dealerId,
        status: 'ACTIVE',
        slug: c.listingSlug,
        submittedAt: c.submittedAt,
        lastSubmittedAt: c.submittedAt,
        submissionCount: 1,
        publishedAt: new Date(anchor.getTime() - rank * 60000),
      },
    });
    for (const [position, view] of (key === 'elevate'
      ? gallery
      : ['hero', 'rear', 'dashboard']
    ).entries()) {
      const mediaId = await media(`vehicles/${key}/${view}.png`, dealerId, 'VEHICLE');
      await db.vehicleMedia.create({
        data: {
          id: devUuid(`promo-image:${key}:${view}`),
          vehicleId: c.id,
          mediaId,
          position,
          isPrimary: position === 0,
          source: 'ADMIN_UPLOAD',
          addedBy: ownerIds.get(c.dealerGstin)!,
        },
      });
    }
    await db.vehiclePhotography.create({ data: { vehicleId: c.id, status: 'READY' } });
    storyCars.push({
      key,
      id: c.id,
      listingId: c.listingId,
      slug: c.listingSlug,
      dealerSlug: c.dealerSlug,
    });
  }
  // Existing seed draft gives the dealer a real editable vehicle to submit.
  const draft = all[0]!;
  await db.vehicle.create({
    data: {
      id: draft.id,
      dealerId: dealerIds.get(draft.dealerGstin),
      registrationNumber: draft.registrationNumber,
      make: draft.make,
      model: draft.model,
      variant: draft.variant,
      manufacturingYear: draft.manufacturingYear,
      registrationYear: draft.registrationYear,
      rtoCode: draft.rtoCode,
      fuelType: draft.fuelType,
      transmission: draft.transmission,
      bodyType: draft.bodyType,
      kilometersDriven: draft.kilometersDriven,
      ownerCount: 1,
      color: draft.color,
      pricePaise: draft.pricePaise,
      insuranceType: 'COMPREHENSIVE',
      insuranceValidUntil: new Date('2027-09-01'),
      listing: {
        create: {
          id: draft.listingId,
          dealerId: dealerIds.get(draft.dealerGstin),
          status: 'DRAFT',
        },
      },
    },
  });
  const customerId = devUuid('promo-customer-arjun');
  await db.user.create({
    data: {
      id: customerId,
      fullName: 'Arjun',
      phone: '+919000000201',
      phoneVerifiedAt: anchor,
      roles: { create: { role: 'CUSTOMER' } },
    },
  });

  // Fixture for the post-Google onboarding stage. No OAuth request or credentials are fabricated on film.
  const newcomerId = devUuid('promo-new-dealer');
  await db.user.create({
    data: {
      id: newcomerId,
      fullName: 'Karthik',
      phone: '+919000000202',
      email: 'karthik@example.invalid',
      emailVerifiedAt: anchor,
      phoneVerifiedAt: anchor,
      roles: { create: { role: 'DEALER' } },
      identities: {
        create: {
          provider: 'GOOGLE',
          providerSubject: 'promo-fixture-karthik',
          email: 'karthik@example.invalid',
          emailVerified: true,
          displayName: 'Karthik',
        },
      },
    },
  });
  const cover = devUuid('promo-media:dealers/dealer-1.png');
  for (const [key, value] of Object.entries({
    'home.heroImageUrl': `${API}/media/by-media/${cover}/1600.webp`,
    'home.heroImageAlt': 'Independent used-car dealership in South India',
  }))
    await db.platformConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  await writeFile(
    resolve(PROMO, 'story.json'),
    JSON.stringify(
      {
        cars: storyCars,
        draftId: draft.id,
        customerPhone: '9000000201',
        dealerPhone: '9000000100',
        newcomerPhone: '9000000202',
        featured: storyCars[0],
        customerId,
        newcomerId,
        dealerId: dealerIds.get(DEV_DEALERS[0]!.gstin),
      },
      null,
      2,
    ),
  );
  console.log(
    `Promotional database ready: ${specs.length} photographed cars, 6 dealerships, one editable draft. Production untouched.`,
  );
}
seed().finally(() => db.$disconnect());
