import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { DEALERS } from './data.js';

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
 * needs two things from it: an admin row that predates Google sign-in, so the
 * allow-listed address is proved to *link* to it rather than to create a
 * second, and one dealership whose owner address is not allow-listed. The rest
 * arrives with **F097**, which owns this file.
 *
 * It needed a third thing until the `cities` table went — a city row to
 * onboard into. Onboarding now types its city, so the suite no longer depends
 * on reference data existing before it runs.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient();
const now = new Date();

/**
 * The one admin account, and no credential anywhere on it.
 *
 * There is nothing to seed a password with any more: the console is entered by
 * signing in with Google as an address on `ADMIN_ALLOWLIST`, and the callback
 * links that identity onto this row the first time it is used. What this seed
 * provides is the row itself — a name, a role and a verified address — so the
 * first sign-in is a link rather than a fresh account with no history.
 */
async function seedAdmin(): Promise<void> {
  // The first allow-listed address, because that is the only account anybody
  // can actually sign in as. Seeding a different one would create a row that
  // looks like an admin and is refused at the door.
  const email = env.adminAllowlist[0];
  if (!email) {
    console.warn('ADMIN_ALLOWLIST is empty — no admin seeded, and none could sign in.');
    return;
  }

  await prisma.user.create({
    data: {
      fullName: 'Dealers-Drive Operations',
      email,
      phone: '+919000000001',
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      isPlatformAdmin: true,
      adminRole: 'SUPER_ADMIN',
    },
  });
}

/**
 * The owner's address is deliberately **not** on `ADMIN_ALLOWLIST`:
 * `auth.test.ts` takes this dealership through the admin sign-in flow and
 * expects to be refused, which is the check that the allow-list is doing the
 * work rather than the session scope alone.
 */
async function seedDealers(): Promise<void> {
  for (const seed of DEALERS) {
    const owner = await prisma.user.create({
      data: {
        fullName: seed.ownerName,
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
        city: seed.city,
        district: seed.district,
        state: seed.state,
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
  await seedAdmin();
  await seedDealers();

  console.log(`seeded 1 admin and ${String(DEALERS.length)} dealership`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
