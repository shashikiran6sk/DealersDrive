import type { Listing, ListingStatus, Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { VehicleRow } from '../../../../src/modules/vehicles/vehicles.repository.js';
import { createVehiclesService } from '../../../../src/modules/vehicles/vehicles.service.js';

const ACTOR = { dealerId: '11111111-1111-4111-8111-111111111111', userId: 'user-1' };
const ID = '22222222-2222-4222-8222-222222222222';

function listing(status: ListingStatus = 'DRAFT'): Listing {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    vehicleId: ID,
    dealerId: ACTOR.dealerId,
    status,
    slug: null,
    submittedAt: null,
    lastSubmittedAt: null,
    submissionCount: 0,
    publishedAt: null,
    soldAt: null,
    reservedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    withdrawalNote: null,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };
}

function row(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: ID,
    dealerId: ACTOR.dealerId,
    registrationNumber: 'KA01AB1234',
    rtoCode: 'KA01',
    make: null,
    model: null,
    variant: null,
    manufacturingYear: null,
    registrationYear: null,
    fuelType: null,
    transmission: null,
    bodyType: null,
    kilometersDriven: null,
    ownerCount: null,
    color: null,
    legacyColor: null,
    insuranceType: null,
    insuranceValidUntil: null,
    pricePaise: null,
    negotiability: null,
    description: null,
    releasedAt: null,
    claimedAt: null,
    createdBy: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    listing: listing(),
    ...overrides,
  };
}

function setup(
  repoOverrides: Record<string, unknown> = {},
  locked: ListingStatus | null = 'DRAFT',
) {
  const repo = {
    create: vi.fn(async () => row()),
    findOwned: vi.fn(async () => row()),
    findById: vi.fn(),
    updateOwned: vi.fn(async () => row()),
    deleteOwned: vi.fn(async () => true),
    heldRegistration: vi.fn(async () => null),
    listForDealer: vi.fn(),
    existingSpelling: vi.fn(async () => null),
    suggestions: vi.fn(async () => ['Creta']),
    inventory: vi.fn(async () => [row()]),
    statusCounts: vi.fn(async () => [{ status: 'DRAFT' as const, count: 1 }]),
    ...repoOverrides,
  };
  const audit = { record: vi.fn(async () => undefined), recordDetached: vi.fn() };
  const tx = {
    $queryRaw: async (query: Prisma.Sql | TemplateStringsArray) => {
      const sql = 'sql' in query ? query.sql : query.join('');
      if (sql.includes('"dealer_members"')) return [{ status: 'ACTIVE', role: 'OWNER' }];
      if (sql.includes('"dealers"') || sql.includes('"users"') || sql.includes('"user_roles"')) {
        return [{ status: 'ACTIVE' }];
      }
      return locked ? [{ id: listing().id }] : [];
    },
    listing: {
      create: async () => listing(),
      findUnique: async () => (locked ? listing(locked) : null),
    },
  };
  const prisma = {
    $transaction: async (work: (client: unknown) => Promise<unknown>) => work(tx),
  } as unknown as PrismaClient;
  const service = createVehiclesService({ prisma, repo: repo, audit });
  return { service, repo, audit };
}

const uniqueViolation = Object.assign(new Error('unique'), { code: 'P2002' });

describe('create', () => {
  it('turns a lost race on the unique index into the same 409', async () => {
    const { service } = setup({ create: vi.fn(async () => Promise.reject(uniqueViolation)) });
    await expect(service.create(ACTOR, { registrationNumber: 'KA01AB1234' })).rejects.toMatchObject(
      { status: 409, code: 'DUPLICATE_REGISTRATION' },
    );
  });

  it('lets any other failure through untouched', async () => {
    const boom = new Error('connection reset');
    const { service } = setup({ create: vi.fn(async () => Promise.reject(boom)) });
    await expect(service.create(ACTOR, { registrationNumber: 'KA01AB1234' })).rejects.toBe(boom);
  });

  it('records no rto for a Bharat-series plate', async () => {
    const { service, repo } = setup();
    await service.create(ACTOR, { registrationNumber: '22BH1234AA' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ registrationNumber: '22BH1234AA', rtoCode: null }),
      expect.anything(),
    );
  });
});

describe('update', () => {
  it('writes nothing and audits nothing for an empty patch', async () => {
    const { service, repo, audit } = setup();
    await service.update(ACTOR, ID, {});
    expect(repo.updateOwned).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not re-check a plate that has not changed', async () => {
    const { service, repo } = setup();
    await service.update(ACTOR, ID, { registrationNumber: 'KA01AB1234' });
    expect(repo.heldRegistration).not.toHaveBeenCalled();
  });

  it('converts money to BigInt and the insurance date to a calendar date', async () => {
    const { service, repo } = setup();
    await service.update(ACTOR, ID, {
      pricePaise: 145_000_000,
      insuranceValidUntil: '2027-03-31',
      description: '',
    });
    expect(repo.updateOwned).toHaveBeenCalledWith(
      ACTOR.dealerId,
      ID,
      {
        pricePaise: 145_000_000n,
        insuranceValidUntil: new Date('2027-03-31T00:00:00Z'),
        description: null,
      },
      expect.anything(),
    );
  });

  it('clears money and the date with null', async () => {
    const { service, repo } = setup();
    await service.update(ACTOR, ID, { pricePaise: null, insuranceValidUntil: null, model: null });
    expect(repo.updateOwned).toHaveBeenCalledWith(
      ACTOR.dealerId,
      ID,
      { pricePaise: null, insuranceValidUntil: null, model: null },
      expect.anything(),
    );
  });

  it('reports a row that vanished mid-write as not found', async () => {
    const { service } = setup({ updateOwned: vi.fn(async () => null) });
    await expect(service.update(ACTOR, ID, { make: 'Tata' })).rejects.toMatchObject({
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
    });
  });

  it('turns a lost plate race into the same 409', async () => {
    const { service } = setup({
      updateOwned: vi.fn(async () => Promise.reject(uniqueViolation)),
    });
    await expect(
      service.update(ACTOR, ID, { registrationNumber: 'KA02AB1234' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_REGISTRATION' });
  });

  it('lets any other write failure through untouched', async () => {
    const boom = new Error('deadlock');
    const { service } = setup({ updateOwned: vi.fn(async () => Promise.reject(boom)) });
    await expect(service.update(ACTOR, ID, { make: 'Tata' })).rejects.toBe(boom);
  });
});

describe('remove', () => {
  it('reports a row that vanished mid-delete as not found', async () => {
    const { service } = setup({ deleteOwned: vi.fn(async () => false) });
    await expect(service.remove(ACTOR, ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe('suggestions', () => {
  it('asks the repository for at most eight', async () => {
    const { service, repo } = setup();
    await expect(service.suggestions({ field: 'model', q: 'Cr' })).resolves.toEqual({
      field: 'model',
      values: ['Creta'],
    });
    expect(repo.suggestions).toHaveBeenCalledWith('model', 'Cr', 8);
  });
});

describe('the listing decides what a dealer may still change', () => {
  it('creates a DRAFT listing with every vehicle', async () => {
    const { service } = setup();
    const created = await service.create(ACTOR, { registrationNumber: 'KA01AB1234' });
    expect(created.listing).toMatchObject({ status: 'DRAFT', canEdit: true, canDelete: true });
  });

  it.each(['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SOLD', 'WITHDRAWN'] as const)(
    'refuses an edit while the listing is %s',
    async (status) => {
      const { service, repo } = setup({
        findOwned: vi.fn(async () => row({ listing: listing(status) })),
      });
      await expect(service.update(ACTOR, ID, { make: 'Tata' })).rejects.toMatchObject({
        status: 409,
        code: 'VEHICLE_NOT_EDITABLE',
      });
      expect(repo.updateOwned).not.toHaveBeenCalled();
    },
  );

  it('re-checks under the row lock, so a submission that won the race wins', async () => {
    const { service, repo } = setup({}, 'PENDING_REVIEW');
    await expect(service.update(ACTOR, ID, { make: 'Tata' })).rejects.toMatchObject({
      code: 'VEHICLE_NOT_EDITABLE',
    });
    expect(repo.updateOwned).not.toHaveBeenCalled();
  });

  it('allows an edit once changes have been requested', async () => {
    const { service, repo } = setup(
      { findOwned: vi.fn(async () => row({ listing: listing('CHANGES_REQUESTED') })) },
      'CHANGES_REQUESTED',
    );
    await service.update(ACTOR, ID, { make: 'Tata' });
    expect(repo.updateOwned).toHaveBeenCalled();
  });

  it.each(['PENDING_REVIEW', 'CHANGES_REQUESTED', 'ACTIVE', 'REJECTED', 'SOLD'] as const)(
    'refuses to delete a %s vehicle — it is history',
    async (status) => {
      const { service, repo } = setup({}, status);
      await expect(service.remove(ACTOR, ID)).rejects.toMatchObject({
        status: 409,
        code: 'VEHICLE_NOT_DELETABLE',
      });
      expect(repo.deleteOwned).not.toHaveBeenCalled();
    },
  );

  it('refuses to describe a vehicle that somehow has no listing', async () => {
    const { service } = setup({ findOwned: vi.fn(async () => row({ listing: null })) });
    await expect(service.get(ACTOR.dealerId, ID)).rejects.toThrow(/has no listing/);
  });

  it('reports a listing that vanished before the lock as not found', async () => {
    const { service } = setup({}, null);
    await expect(service.update(ACTOR, ID, { make: 'Tata' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
