import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createVehiclesRepository } from '../../../../src/modules/vehicles/vehicles.repository.js';

interface Call {
  model: string;
  method: string;
  args: Record<string, unknown>;
}

function fakePrisma(results: Record<string, unknown> = {}) {
  const calls: Call[] = [];

  const client = new Proxy(
    {},
    {
      get: (_client, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_model, method: string) =>
              (args: Record<string, unknown> = {}) => {
                calls.push({ model, method, args });
                return Promise.resolve(results[`${model}.${method}`] ?? null);
              },
          },
        ),
    },
  ) as unknown as PrismaClient;

  return { prisma: client, calls };
}

const DEALER = '11111111-1111-4111-8111-111111111111';
const VEHICLE = '22222222-2222-4222-8222-222222222222';

describe('tenant scoping', () => {
  it('reads a vehicle only through its dealership', async () => {
    const { prisma, calls } = fakePrisma();
    await createVehiclesRepository(prisma).findOwned(DEALER, VEHICLE);

    expect(calls[0]).toEqual({
      model: 'vehicle',
      method: 'findFirst',
      args: { where: { id: VEHICLE, dealerId: DEALER } },
    });
  });

  it('updates only a row the dealership owns, and reports a miss as null', async () => {
    const { prisma, calls } = fakePrisma({ 'vehicle.updateMany': { count: 0 } });
    const result = await createVehiclesRepository(prisma).updateOwned(DEALER, VEHICLE, {
      make: 'Tata',
    });

    expect(result).toBeNull();
    expect(calls[0]?.args).toEqual({
      where: { id: VEHICLE, dealerId: DEALER },
      data: { make: 'Tata' },
    });
    expect(calls).toHaveLength(1);
  });

  it('re-reads the row after a successful scoped update', async () => {
    const row = { id: VEHICLE };
    const { prisma, calls } = fakePrisma({
      'vehicle.updateMany': { count: 1 },
      'vehicle.findUnique': row,
    });

    await expect(
      createVehiclesRepository(prisma).updateOwned(DEALER, VEHICLE, { model: 'Nexon' }),
    ).resolves.toBe(row);
    expect(calls[1]).toMatchObject({ method: 'findUnique', args: { where: { id: VEHICLE } } });
  });

  it('deletes only a row the dealership owns', async () => {
    const { prisma, calls } = fakePrisma({ 'vehicle.deleteMany': { count: 1 } });
    await expect(createVehiclesRepository(prisma).deleteOwned(DEALER, VEHICLE)).resolves.toBe(true);
    expect(calls[0]?.args).toEqual({ where: { id: VEHICLE, dealerId: DEALER } });
  });

  it('reports a delete that matched nothing', async () => {
    const { prisma } = fakePrisma({ 'vehicle.deleteMany': { count: 0 } });
    await expect(createVehiclesRepository(prisma).deleteOwned(DEALER, VEHICLE)).resolves.toBe(
      false,
    );
  });

  it('lists one dealership, newest first, with a stable tie-break', async () => {
    const { prisma, calls } = fakePrisma({ 'vehicle.findMany': [] });
    await createVehiclesRepository(prisma).listForDealer(DEALER);

    expect(calls[0]?.args).toEqual({
      where: { dealerId: DEALER },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });
});

describe('transactions', () => {
  it('writes through the transaction client when one is given', async () => {
    const outside = fakePrisma();
    const inside = fakePrisma({ 'vehicle.create': { id: VEHICLE } });
    const repo = createVehiclesRepository(outside.prisma);

    await repo.create(
      { dealerId: DEALER, registrationNumber: 'KA01AB1234', rtoCode: 'KA01', createdBy: null },
      inside.prisma,
    );
    await repo.findById(VEHICLE, inside.prisma);

    expect(outside.calls).toHaveLength(0);
    expect(inside.calls.map((call) => call.method)).toEqual(['create', 'findUnique']);
  });
});

describe('spelling', () => {
  it('finds the first spelling already in use, case-insensitively', async () => {
    const { prisma, calls } = fakePrisma({ 'vehicle.findFirst': { make: 'Maruti Suzuki' } });
    await expect(
      createVehiclesRepository(prisma).existingSpelling('make', 'maruti suzuki'),
    ).resolves.toBe('Maruti Suzuki');

    expect(calls[0]?.args).toEqual({
      where: { make: { equals: 'maruti suzuki', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      select: { make: true },
    });
  });

  it('answers null for a spelling nobody has used', async () => {
    const { prisma } = fakePrisma();
    await expect(
      createVehiclesRepository(prisma).existingSpelling('model', 'Creta'),
    ).resolves.toBeNull();
  });

  it('suggests distinct values by prefix and drops empty ones', async () => {
    const { prisma, calls } = fakePrisma({
      'vehicle.findMany': [{ model: 'Creta' }, { model: null }, { model: 'Crysta' }],
    });
    await expect(createVehiclesRepository(prisma).suggestions('model', 'Cr', 8)).resolves.toEqual([
      'Creta',
      'Crysta',
    ]);

    expect(calls[0]?.args).toEqual({
      where: { model: { startsWith: 'Cr', mode: 'insensitive' } },
      distinct: ['model'],
      orderBy: { model: 'asc' },
      take: 8,
      select: { model: true },
    });
  });
});

describe('heldRegistration', () => {
  it('looks only at vehicles that still hold their number, in one dealership', async () => {
    const { prisma, calls } = fakePrisma();
    await createVehiclesRepository(prisma).heldRegistration(DEALER, 'KA01AB1234');

    expect(calls[0]?.args).toEqual({
      where: { dealerId: DEALER, registrationNumber: 'KA01AB1234', releasedAt: null },
    });
  });

  it('can leave the vehicle being edited out of the question', async () => {
    const { prisma, calls } = fakePrisma();
    await createVehiclesRepository(prisma).heldRegistration(DEALER, 'KA01AB1234', VEHICLE);

    expect(calls[0]?.args).toEqual({
      where: {
        dealerId: DEALER,
        registrationNumber: 'KA01AB1234',
        releasedAt: null,
        id: { not: VEHICLE },
      },
    });
  });
});
