import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { DEV_DEALERS, DEV_STATES } from './dev-dealers.data.js';

/**
 * Writes a hundred and twenty dealerships — thirty each in Tamil Nadu,
 * Karnataka, Andhra Pradesh and Kerala — into a **local** database, so the
 * directory and the portfolio page have something to be looked at.
 *
 *     pnpm --filter @dealers-drive/api db:seed:dev
 *
 * ── What this is not ────────────────────────────────────────────────────────
 * It is not part of `pnpm db:seed`, and `tests/global-setup.ts` does not call
 * it. The test seed stays at one dealership because `auth.test.ts` is written
 * against one; adding a hundred and nineteen rows to every integration run
 * would cost every suite and buy no test anything. See the header of
 * `dev-dealers.data.ts`.
 *
 * ── Why it refuses to run against a remote database ─────────────────────────
 * This writes a hundred and twenty invented dealerships with invented GSTINs
 * across four states. Pointed at a shared or hosted database that is not a
 * mistake you notice — it is a hundred and twenty rows a colleague then has to
 * identify and delete by hand, and on a public marketplace it is a hundred and
 * twenty businesses that do not exist. So the host in `DATABASE_URL` has to be
 * a loopback address, and overriding that has to be typed out in full:
 *
 *     ALLOW_REMOTE_DEV_SEED=yes pnpm --filter @dealers-drive/api db:seed:dev
 *
 * ── Re-running it ───────────────────────────────────────────────────────────
 * Every write is an upsert keyed on the GSTIN or the email, so running it
 * twice updates the rows rather than colliding on `dealers_gstin_key`. That makes
 * it the right way to pick up an edit to the data file, and it means it can be
 * run over a database that already has the ordinary seed in it.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient();
const now = new Date();

/** Loopback only, unless the operator says otherwise in words. */
function assertLocalDatabase(): void {
  if (process.env.ALLOW_REMOTE_DEV_SEED === 'yes') {
    console.warn('ALLOW_REMOTE_DEV_SEED=yes — writing dev dealerships to a non-local database.');
    return;
  }

  if (env.isProduction) {
    throw new Error('dev-dealers refuses to run with NODE_ENV=production.');
  }

  const host = new URL(env.DATABASE_URL).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (!isLocal) {
    throw new Error(
      `DATABASE_URL points at "${host}", not at localhost.\n` +
        'These are a hundred and twenty invented dealerships — they do not belong in a shared database.\n' +
        'If you meant it: ALLOW_REMOTE_DEV_SEED=yes pnpm --filter @dealers-drive/api db:seed:dev',
    );
  }
}

/**
 * The owner account behind a dealership.
 *
 * Keyed on the email because that is what a dealer signs in with. No password
 * and no OAuth identity: these accounts exist to own a row, not to be signed in
 * as — sign-in is `DEV_DEALER_SLUG` in development, or a real Google account.
 */
async function upsertOwner(dealer: (typeof DEV_DEALERS)[number]): Promise<string> {
  const fields = {
    fullName: dealer.ownerName,
    phone: dealer.phone,
    emailVerifiedAt: now,
    phoneVerifiedAt: now,
  };

  const owner = await prisma.user.upsert({
    where: { email: dealer.email },
    update: fields,
    create: { email: dealer.email, ...fields },
  });

  return owner.id;
}

async function seedDealer(dealer: (typeof DEV_DEALERS)[number]): Promise<void> {
  const ownerId = await upsertOwner(dealer);

  const fields = {
    brandName: dealer.brandName,
    legalName: dealer.legalName,
    tagline: dealer.tagline,
    gstin: dealer.gstin,
    pan: dealer.pan,
    // ACTIVE, and therefore visible: `findPublicBySlug` and `listActive` refuse
    // anything else, so a DRAFT row would seed a directory of nothing.
    status: 'ACTIVE' as const,
    approvedAt: now,
    city: dealer.city,
    district: dealer.district,
    state: dealer.state,
    addressLine: dealer.addressLine,
    pincode: dealer.pincode,
    mapsUrl: dealer.mapsUrl,
    lat: dealer.lat,
    lng: dealer.lng,
    contactPhone: dealer.phone,
    contactEmail: dealer.email,
    landline: dealer.landline,
    workingHours: dealer.workingHours,
    establishedYear: dealer.establishedYear,
    specialities: dealer.specialities,
    medianResponseMins: dealer.medianResponseMins,
  };

  /*
   * Keyed on the **GSTIN**, not on the slug.
   *
   * The slug is derived from the dealership's name and town now, so it moves
   * whenever either of those is corrected in the data file — and an upsert
   * keyed on a value that moves does not update the row, it forks it. The
   * GSTIN is the row's real identity: unique, invented once, and stable
   * against every edit that changes the slug. So `slug` travels in the update
   * payload, which is what makes re-running this the way to pick up a
   * corrected town.
   *
   * That is a licence this seed has and the application does not. A real
   * dealership's slug is written at registration and never again — see
   * `dealerSlug` — because printed URLs and derived storage keys both hang
   * off it.
   */
  const row = await prisma.dealer.upsert({
    where: { gstin: dealer.gstin },
    update: { slug: dealer.slug, ...fields },
    create: { slug: dealer.slug, ...fields },
  });

  await prisma.dealerMember.upsert({
    where: { dealerId_userId: { dealerId: row.id, userId: ownerId } },
    update: { role: 'OWNER' },
    create: { dealerId: row.id, userId: ownerId, role: 'OWNER', permissions: [] },
  });

  // VERIFIED, to match the `isVerified: true` the public profile hard-codes
  // until the KYC review paths land. A dealership showing a verified badge over
  // three REQUIRED documents is a screen that contradicts itself.
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'] as const) {
    await prisma.dealerDocument.upsert({
      where: { dealerId_type: { dealerId: row.id, type } },
      update: { status: 'VERIFIED' },
      create: { dealerId: row.id, type, status: 'VERIFIED' },
    });
  }
}

async function main(): Promise<void> {
  assertLocalDatabase();

  // Sequential on purpose. A hundred and twenty rows is a few seconds, and a
  // `Promise.all` over upserts that share unique indexes is how you get a
  // deadlock that only shows up on someone else's laptop.
  for (const dealer of DEV_DEALERS) {
    await seedDealer(dealer);
  }

  /*
   * State, then district, then the towns inside it.
   *
   * The nesting is not decoration: the three levels are the three things the
   * product groups by, and a run that seeded a town into the wrong district —
   * or, since this file grew past one state, the wrong state — is visible here
   * and nowhere else until somebody notices a directory chip in the wrong
   * place. `DEV_STATES` supplies the order so it does not come out of a `Set`
   * in whatever order the rows happen to sit in.
   */
  console.log(`seeded ${String(DEV_DEALERS.length)} dev dealerships`);

  for (const state of DEV_STATES) {
    const inState = DEV_DEALERS.filter((d) => d.state === state);
    console.log(`  ${state} — ${String(inState.length)}`);

    const districts = [...new Set(inState.map((d) => d.district))].sort((a, b) =>
      a.localeCompare(b),
    );

    for (const district of districts) {
      const inDistrict = inState.filter((d) => d.district === district);
      const towns = [...new Set(inDistrict.map((d) => d.city))];
      console.log(
        `    ${district} district — ${String(inDistrict.length)} across ${towns.join(', ')}`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
