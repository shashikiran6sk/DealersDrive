import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDealersRepository,
  dealerInclude,
} from '../../../../src/modules/dealers/dealers.repository.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';

/**
 * Unit tests for `src/modules/dealers/dealers.repository.ts`.
 *
 * §11.1 — only ACTIVE dealers are ever public — is a `where` clause, and this is
 * the file that has to carry it. `findPublicBySlug` filtering on status is the
 * difference between a suspended dealership vanishing from the marketplace and
 * staying visible with a live phone number, so the query shapes are asserted
 * directly rather than inferred from a seeded row.
 */
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

afterEach(() => {
  vi.useRealTimers();
});

describe('dealerInclude', () => {
  it('brings the city, documents and only ACTIVE members', () => {
    // A removed member must not keep appearing as the owner of the dealership.
    expect(dealerInclude).toEqual({
      city: true,
      documents: true,
      members: { include: { user: true }, where: { status: 'ACTIVE' } },
    });
  });
});

describe('the lookups', () => {
  it('finds by id and by slug with the full relations', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = createDealersRepository(prisma);

    await repo.findById('dealer-1');
    await repo.findBySlug('sri-lakshmi-motors');

    expect(calls[0]).toMatchObject({
      model: 'dealer',
      method: 'findUnique',
      args: { where: { id: 'dealer-1' }, include: dealerInclude },
    });
    expect(calls[1]?.args).toEqual({
      where: { slug: 'sri-lakshmi-motors' },
      include: dealerInclude,
    });
  });

  it('constrains the public lookup to ACTIVE', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).findPublicBySlug('sri-lakshmi-motors');

    // Without `status: 'ACTIVE'` a suspended dealership would keep its public
    // profile page — §11.1 and rule 6 both fail at once.
    expect(calls[0]).toMatchObject({
      method: 'findFirst',
      args: { where: { slug: 'sri-lakshmi-motors', status: 'ACTIVE' } },
    });
  });

  it('uses findFirst for the public lookup, since the filter is not a unique key', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).findPublicBySlug('x');

    expect(calls[0]?.method).toBe('findFirst');
  });
});

describe('listActive', () => {
  it('lists only ACTIVE dealerships, alphabetically', async () => {
    const { prisma, calls } = fakePrisma({ 'dealer.findMany': [] });

    await createDealersRepository(prisma).listActive();

    expect(calls[0]?.args).toEqual({
      where: { status: 'ACTIVE' },
      include: { city: true },
      orderBy: { brandName: 'asc' },
    });
  });

  it('projects a card-shaped row rather than the whole record', async () => {
    const { prisma } = fakePrisma({
      'dealer.findMany': [
        {
          id: 'dealer-1',
          slug: 'sri-lakshmi-motors',
          brandName: 'Sri Lakshmi Motors',
          tagline: 'Trusted since 2009',
          specialities: ['Hatchbacks'],
          establishedYear: 2009,
          contactPhone: '9840012345',
          gstin: '33AABCS1429B1ZX',
          city: { name: 'Vellore', slug: 'vellore', state: 'Tamil Nadu' },
        },
      ],
    });

    const [dealer] = await createDealersRepository(prisma).listActive();

    // The directory renders these; the phone number and GSTIN must not travel
    // with them, because this projection feeds a public response.
    expect(Object.keys(dealer ?? {}).sort()).toEqual(
      [
        'brandName',
        'citySlug',
        'cityName',
        'id',
        'initials',
        'slug',
        'specialities',
        'state',
        'tagline',
        'yearsOperating',
      ].sort(),
    );
    expect(dealer).not.toHaveProperty('contactPhone');
    expect(dealer).not.toHaveProperty('gstin');
  });

  it('derives initials from the brand name', async () => {
    const { prisma } = fakePrisma({
      'dealer.findMany': [{ slug: 'a', brandName: 'Velavan Cars', specialities: [], city: null }],
    });

    expect((await createDealersRepository(prisma).listActive())[0]?.initials).toBe('VC');
  });

  it('flattens the city, defaulting the state', async () => {
    const { prisma } = fakePrisma({
      'dealer.findMany': [{ slug: 'a', brandName: 'A', specialities: [], city: null }],
    });

    const [dealer] = await createDealersRepository(prisma).listActive();

    expect(dealer?.cityName).toBeNull();
    expect(dealer?.citySlug).toBeNull();
    expect(dealer?.state).toBe('Tamil Nadu');
  });

  it('computes years operating, never below one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const { prisma } = fakePrisma({
      'dealer.findMany': [
        { slug: 'a', brandName: 'A', specialities: [], city: null, establishedYear: 2009 },
        { slug: 'b', brandName: 'B', specialities: [], city: null, establishedYear: 2026 },
        { slug: 'c', brandName: 'C', specialities: [], city: null, establishedYear: null },
      ],
    });

    const dealers = await createDealersRepository(prisma).listActive();

    expect(dealers.map((dealer) => dealer.yearsOperating)).toEqual([17, 1, 1]);
  });
});

describe('update', () => {
  it('writes through the client by default', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).update('dealer-1', { tagline: 'New' });

    expect(calls[0]).toMatchObject({
      model: 'dealer',
      method: 'update',
      args: { where: { id: 'dealer-1' }, data: { tagline: 'New' }, include: dealerInclude },
    });
  });

  it('writes through a transaction when one is supplied', async () => {
    const { prisma, calls } = fakePrisma();
    const txCalls: Call[] = [];
    const tx = {
      dealer: {
        update: (args: Record<string, unknown>) => {
          txCalls.push({ model: 'dealer', method: 'update', args });
          return Promise.resolve({});
        },
      },
    } as unknown as Tx;

    await createDealersRepository(prisma).update('dealer-1', { status: 'PENDING_APPROVAL' }, tx);

    // The status change and its outbox row have to commit together, so the
    // transaction handle must actually be used.
    expect(txCalls).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});

describe('the KYC document methods', () => {
  it('lists a dealership’s documents in a stable order', async () => {
    const { prisma, calls } = fakePrisma({ 'dealerDocument.findMany': [] });

    await createDealersRepository(prisma).documents('dealer-1');

    expect(calls[0]?.args).toEqual({ where: { dealerId: 'dealer-1' }, orderBy: { type: 'asc' } });
  });

  it('finds one document by id, unscoped — the service checks the owner', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).documentById('doc-1');

    // Deliberate: `commitDocument` compares `doc.dealerId` to the session and
    // 404s a mismatch, which is what lets the error say nothing about existence.
    expect(calls[0]?.args).toEqual({ where: { id: 'doc-1' } });
  });

  it('upserts on the dealership-and-type pair', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).upsertDocument('dealer-1', 'GST_CERTIFICATE', {
      status: 'UPLOADING',
      fileName: 'gst.pdf',
    });

    // One row per type per dealership: re-uploading replaces rather than
    // accumulating, so the checklist cannot show two GST certificates.
    expect(calls[0]).toMatchObject({
      method: 'upsert',
      args: {
        where: { dealerId_type: { dealerId: 'dealer-1', type: 'GST_CERTIFICATE' } },
        create: { dealerId: 'dealer-1', type: 'GST_CERTIFICATE', status: 'UPLOADING' },
        update: { status: 'UPLOADING', fileName: 'gst.pdf' },
      },
    });
  });

  it('resets a deleted document to REQUIRED rather than removing the row', async () => {
    const { prisma, calls } = fakePrisma({ 'dealerDocument.updateMany': { count: 1 } });

    const removed = await createDealersRepository(prisma).deleteDocument(
      'dealer-1',
      'GST_CERTIFICATE',
    );

    // The checklist needs the row to keep showing the requirement; clearing the
    // rejection reason is what stops "Too blurry" outliving the file.
    expect(calls[0]).toMatchObject({
      method: 'updateMany',
      args: {
        where: { dealerId: 'dealer-1', type: 'GST_CERTIFICATE' },
        data: { status: 'REQUIRED', mediaId: null, fileName: null, rejectionReason: null },
      },
    });
    expect(removed).toBe(true);
  });

  it('reports false when there was nothing to reset', async () => {
    const { prisma } = fakePrisma({ 'dealerDocument.updateMany': { count: 0 } });

    expect(await createDealersRepository(prisma).deleteDocument('dealer-1', 'PAN_CARD')).toBe(
      false,
    );
  });

  it('scopes the delete by dealership, so one tenant cannot clear another’s', async () => {
    const { prisma, calls } = fakePrisma({ 'dealerDocument.updateMany': { count: 0 } });

    await createDealersRepository(prisma).deleteDocument('dealer-1', 'PAN_CARD');

    expect((calls[0]?.args.where as Record<string, unknown>).dealerId).toBe('dealer-1');
  });
});

describe('ownerOf', () => {
  it('finds the active owner and their user record', async () => {
    const { prisma, calls } = fakePrisma();

    await createDealersRepository(prisma).ownerOf('dealer-1');

    expect(calls[0]?.args).toEqual({
      where: { dealerId: 'dealer-1', role: 'OWNER', status: 'ACTIVE' },
      include: { user: true },
    });
  });
});

describe('the console counters', () => {
  /**
   * ── Reconstruction slice ────────────────────────────────────────────────
   * The baseline has three cases here, asserting the `where` clauses of
   * `prisma.enquiry.count` and `prisma.listing.count`. Neither model exists
   * yet — `Enquiry` arrives at F088 and `Listing` at F064 — so the repository
   * returns zero and those three cases return with the queries they describe.
   * What can be asserted now is that both counters exist and are safe to call,
   * which is what `dealers.service.session()` needs of them at F018.
   */
  it('answers zero for both until the enquiry and listing tables exist', async () => {
    const { prisma, calls } = fakePrisma();
    const repo = createDealersRepository(prisma);

    expect(await repo.newEnquiryCount('dealer-1')).toBe(0);
    expect(await repo.pendingListingCount('dealer-1')).toBe(0);
    expect(calls).toEqual([]);
  });
});
