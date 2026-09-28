import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../../src/config/env.js';
import { DEV_DEALERS, DEV_STATES } from './dev-dealers.data.js';
import { assertLocalDatabase } from './dev-guard.js';
import { generateDevVehicles, type DevVehicle } from './dev-vehicles.data.js';

/**
 * Writes the dev cars — `dev-vehicles.data.ts` — onto the dev dealerships.
 *
 *     pnpm db:seed:dev              dealerships first, then this
 *     pnpm db:seed:vehicles:dev     this alone, once the dealerships exist
 *
 * ── Ordering is checked, not assumed ────────────────────────────────────────
 * The cars are linked to dealerships **by GSTIN**, the dealership's stable
 * identity (see `dev-dealers.ts`), and every one of the hundred and twenty is
 * looked up before a single car is written. A missing one stops the run with
 * the command that fixes it, rather than seeding cars onto whichever
 * dealerships happened to be there.
 *
 * ── Re-running it ───────────────────────────────────────────────────────────
 * Every row has a deterministic id, so a vehicle and its listing are upserted
 * **by id**: running this twice updates three hundred and twenty cars, it does
 * not add three hundred and twenty more. A seeded car that a newer data file
 * no longer generates is removed — recognised as a vehicle of a dev dealership
 * with no `createdBy`, which a car a person entered through the console always
 * has. Nothing a developer created by hand is touched.
 * ────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

async function dealerIds(): Promise<Map<string, string>> {
  const rows = await prisma.dealer.findMany({
    where: { gstin: { in: DEV_DEALERS.map((dealer) => dealer.gstin) } },
    select: { id: true, gstin: true },
  });
  const ids = new Map<string, string>();
  for (const row of rows) if (row.gstin) ids.set(row.gstin, row.id);
  const missing = DEV_DEALERS.filter((dealer) => !ids.has(dealer.gstin));

  if (missing.length > 0) {
    throw new Error(
      `${String(missing.length)} of ${String(DEV_DEALERS.length)} dev dealerships are not in the database ` +
        `(first: ${missing[0]?.brandName ?? ''}).\n` +
        'Seed them first: pnpm db:seed:dev — which writes the dealerships and then these cars.',
    );
  }
  return ids;
}

async function writeVehicle(car: DevVehicle, dealerId: string): Promise<void> {
  const vehicle = {
    dealerId,
    registrationNumber: car.registrationNumber,
    rtoCode: car.rtoCode,
    make: car.make,
    model: car.model,
    variant: car.variant,
    manufacturingYear: car.manufacturingYear,
    registrationYear: car.registrationYear,
    fuelType: car.fuelType,
    transmission: car.transmission,
    bodyType: car.bodyType,
    kilometersDriven: car.kilometersDriven,
    ownerCount: car.ownerCount,
    color: car.color,
    insuranceType: 'COMPREHENSIVE' as const,
    pricePaise: car.pricePaise,
    negotiability: 'SLIGHTLY' as const,
    description: `${car.make} ${car.model} ${car.variant}, kept at ${car.city}.`,
    claimedAt: car.claimedAt,
    releasedAt: car.releasedAt,
  };

  const listing = {
    dealerId,
    status: car.status,
    submittedAt: car.submittedAt,
    lastSubmittedAt: car.submittedAt,
    submissionCount: car.submittedAt ? 1 : 0,
    publishedAt: car.publishedAt,
    slug: car.listingSlug,
    reservedAt: car.reservedAt,
    soldAt: car.soldAt,
    withdrawnAt: car.withdrawnAt,
    withdrawalReason: car.withdrawalReason,
    withdrawalNote: null,
    decisionReason: car.decisionReason,
    decidedAt: car.decisionReason || car.publishedAt ? (car.publishedAt ?? car.submittedAt) : null,
  };

  await prisma.$transaction([
    prisma.vehicle.upsert({
      where: { id: car.id },
      update: vehicle,
      create: { id: car.id, ...vehicle },
    }),
    prisma.listing.upsert({
      where: { id: car.listingId },
      update: listing,
      create: { id: car.listingId, vehicleId: car.id, ...listing },
    }),
  ]);
}

function countBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
}

function report(cars: readonly DevVehicle[], pruned: number): void {
  const live = cars.filter((car) => car.status === 'ACTIVE');

  console.log('Development vehicle seed complete\n');
  console.log(`  Dealers:          ${String(DEV_DEALERS.length)}`);
  console.log(`  Vehicles:         ${String(cars.length)}`);
  console.log(`  Active listings:  ${String(live.length)}`);
  if (pruned > 0) console.log(`  Removed (stale):  ${String(pruned)}`);

  console.log('\n  By status:');
  for (const [status, count] of countBy(cars, (car) => car.status)) {
    console.log(`    ${status.padEnd(18)} ${String(count)}`);
  }

  console.log('\n  Active by district:');
  for (const state of DEV_STATES) {
    const inState = live.filter((car) => car.state === state);
    console.log(`    ${state} — ${String(inState.length)}`);
    for (const [district, count] of countBy(inState, (car) => car.district)) {
      const towns = [
        ...countBy(
          inState.filter((car) => car.district === district),
          (car) => car.city,
        ),
      ]
        .map(([town, n]) => `${town} ${String(n)}`)
        .join(' · ');
      console.log(`      ${district}: ${String(count)}  (${towns})`);
    }
  }

  const brands = [...countBy(live, (car) => car.make)].sort((a, b) => b[1] - a[1]);
  console.log(
    `\n  Brands (${String(brands.length)}): ${brands.map(([b, n]) => `${b} ${String(n)}`).join(', ')}`,
  );
  console.log(`  Models: ${String(new Set(live.map((car) => `${car.make} ${car.model}`)).size)}`);
  console.log('  Photographs: none — cards draw the no-photo slot.');
}

async function main(): Promise<void> {
  assertLocalDatabase('cars');

  const ids = await dealerIds();
  const cars = generateDevVehicles(DEV_DEALERS);

  for (const car of cars) {
    const dealerId = ids.get(car.dealerGstin);
    if (!dealerId) throw new Error(`No dealership for GSTIN ${car.dealerGstin}.`);
    await writeVehicle(car, dealerId);
  }

  const { count: pruned } = await prisma.vehicle.deleteMany({
    where: {
      dealerId: { in: [...ids.values()] },
      createdBy: null,
      id: { notIn: cars.map((car) => car.id) },
    },
  });

  report(cars, pruned);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
