import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { CITIES, DEALERS } from './data.js';

/**
 * The development and test seed.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline seed is 837 lines and writes the whole product: the catalogue
 * decision D1 removes, five dealerships, their inventory, listings, the search
 * read model, credits, orders and invoices. Almost none of it can be written
 * before the models exist.
 *
 * What is here is what the integration suite needs to run at all — the
 * `global-setup` for `tests/*.test.ts` calls this file, and `auth.test.ts`
 * needs three things from it: a city to onboard into, an admin with a
 * password, and one dealership whose owner address proves that an account with
 * no password cannot sign in to the admin console. The rest arrives with
 * **F097**, which owns this file.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient();
const now = new Date();

async function seedCities(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const city of CITIES) {
    const row = await prisma.city.upsert({
      where: { slug: city.slug },
      create: city,
      update: city,
    });
    ids.set(city.slug, row.id);
  }

  return ids;
}

/**
 * The one admin account, and the only account in the system with a password.
 *
 * `DEV_ADMIN_PASSWORD` is read once, hashed with the same Argon2id parameters
 * sign-in verifies against, and dropped. The plaintext is never written to a
 * row, never logged, and never returned by any endpoint — the value the
 * developer types comes from their own `.env`, not from anything this seed
 * prints. Re-running the seed re-hashes it, so rotating the variable rotates
 * the credential.
 */
async function seedAdmin(): Promise<void> {
  await prisma.user.create({
    data: {
      fullName: 'Dealers-Drive Operations',
      roleTitle: 'Platform admin',
      email: env.DEV_ADMIN_EMAIL,
      phone: '+919000000001',
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      isPlatformAdmin: true,
      adminRole: 'SUPER_ADMIN',
      passwordHash: await hashPassword(env.DEV_ADMIN_PASSWORD),
    },
  });
}

/**
 * The owner has **no** `passwordHash`, and that is the point of seeding them:
 * `auth.test.ts` signs in to the admin console with this address and expects
 * the same refusal an unknown account gets. Dealers sign in with Google.
 */
async function seedDealers(cities: Map<string, string>): Promise<void> {
  for (const seed of DEALERS) {
    const owner = await prisma.user.create({
      data: {
        fullName: seed.ownerName,
        roleTitle: seed.ownerRole,
        email: seed.email,
        phone: seed.phone,
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
      },
    });

    const dealer = await prisma.dealer.create({
      data: {
        slug: seed.slug,
        brandName: seed.brandName,
        legalName: seed.legalName,
        tagline: seed.tagline,
        gstin: seed.gstin,
        pan: seed.pan,
        status: 'ACTIVE',
        approvedAt: now,
        cityId: cities.get(seed.citySlug) ?? null,
        addressLine: seed.addressLine,
        pincode: seed.pincode,
        lat: seed.lat,
        lng: seed.lng,
        contactPhone: seed.phone,
        contactEmail: seed.email,
        landline: seed.landline,
        establishedYear: seed.establishedYear,
        specialities: [],
      },
    });

    await prisma.dealerMember.create({
      data: { dealerId: dealer.id, userId: owner.id, role: 'OWNER', permissions: [] },
    });

    await prisma.dealerDocument.createMany({
      data: (['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'] as const).map((type) => ({
        dealerId: dealer.id,
        type,
        status: 'VERIFIED' as const,
      })),
    });
  }
}

async function main(): Promise<void> {
  const cities = await seedCities();
  await seedAdmin();
  await seedDealers(cities);

  console.log(
    `seeded ${String(CITIES.length)} cities, 1 admin and ${String(DEALERS.length)} dealership`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
