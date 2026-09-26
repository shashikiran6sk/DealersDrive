import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createVehiclesRepository } from '../src/modules/vehicles/vehicles.repository.js';

/**
 * The vehicle table's own guarantees (**F055**), against the real database.
 *
 * The ranges below are CHECK constraints as well as Zod limits. The Zod limits
 * are what a dealer meets; these are what is left if a future code path forgets
 * to parse — a negative odometer or a zero price is wrong in every state, so the
 * database refuses it whatever wrote it.
 */
let prisma: PrismaClient;
let dealerId: string;
let otherDealerId: string;

async function dealership(label: string): Promise<string> {
  const stamp = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dealer = await prisma.dealer.create({
    data: {
      slug: `vehicle-fixture-${stamp}`,
      brandName: `Vehicle Fixture ${stamp}`,
      legalName: `Vehicle Fixture ${stamp}`,
      city: 'Vellore',
      status: 'ACTIVE',
    },
  });
  return dealer.id;
}

beforeAll(async () => {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  dealerId = await dealership('a');
  otherDealerId = await dealership('b');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the vehicles table', () => {
  it('stores a draft with nothing but a registration number', async () => {
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId,
      registrationNumber: 'KA01AB1234',
      rtoCode: 'KA01',
      createdBy: null,
    });

    expect(vehicle).toMatchObject({ dealerId, registrationNumber: 'KA01AB1234', make: null });
  });

  it('keeps money as BigInt paise', async () => {
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId,
      registrationNumber: 'TN09BX1234',
      rtoCode: 'TN09',
      createdBy: null,
    });
    const priced = await repo.updateOwned(dealerId, vehicle.id, { pricePaise: 145_000_000n });

    expect(priced?.pricePaise).toBe(145_000_000n);
  });

  it.each([
    ['a negative odometer', { kilometersDriven: -1 }],
    ['zero owners', { ownerCount: 0 }],
    ['a zero price', { pricePaise: 0n }],
    ['a year before 1950', { manufacturingYear: 1900 }],
    ['a registration year before 1950', { registrationYear: 1900 }],
  ])('refuses %s at the database', async (_label, data) => {
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId,
      registrationNumber: 'MH12DE1433',
      rtoCode: 'MH12',
      createdBy: null,
    });

    await expect(repo.updateOwned(dealerId, vehicle.id, data)).rejects.toThrow(/check/i);
  });

  it('will not let one dealership read, change or delete another dealership’s car', async () => {
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId,
      registrationNumber: 'DL3CAB1234',
      rtoCode: 'DL3C',
      createdBy: null,
    });

    await expect(repo.findOwned(otherDealerId, vehicle.id)).resolves.toBeNull();
    await expect(repo.updateOwned(otherDealerId, vehicle.id, { make: 'Stolen' })).resolves.toBe(
      null,
    );
    await expect(repo.deleteOwned(otherDealerId, vehicle.id)).resolves.toBe(false);
    await expect(repo.findById(vehicle.id)).resolves.toMatchObject({ make: null });
  });

  it('goes with its dealership', async () => {
    const doomed = await dealership('doomed');
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId: doomed,
      registrationNumber: 'KL07CD5678',
      rtoCode: 'KL07',
      createdBy: null,
    });

    await prisma.dealer.delete({ where: { id: doomed } });
    await expect(repo.findById(vehicle.id)).resolves.toBeNull();
  });

  it('adopts the spelling already in use and suggests by prefix', async () => {
    const repo = createVehiclesRepository(prisma);
    const vehicle = await repo.create({
      dealerId,
      registrationNumber: 'AP09CD4321',
      rtoCode: 'AP09',
      createdBy: null,
    });
    await repo.updateOwned(dealerId, vehicle.id, { make: 'Maruti Suzuki', model: 'Swift Dzire' });

    await expect(repo.existingSpelling('make', 'MARUTI SUZUKI')).resolves.toBe('Maruti Suzuki');
    await expect(repo.suggestions('model', 'swift', 5)).resolves.toContain('Swift Dzire');
  });
});
