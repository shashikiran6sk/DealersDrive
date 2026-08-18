import type { PrismaClient } from '@prisma/client';
import type * as BillingFacade from '../../../../src/modules/billing/billing.facade.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateVehicleInput } from '@dealers-drive/contracts';

import type { DealersRepository } from '../../../../src/modules/dealers/dealers.facade.js';
import type {
  VehiclesRepository,
  VehicleWithRelations,
} from '../../../../src/modules/vehicles/vehicles.repository.js';
import { createVehiclesService } from '../../../../src/modules/vehicles/vehicles.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../../../src/platform/errors.js';

/**
 * Unit tests for `src/modules/vehicles/vehicles.service.ts`.
 *
 * This is the credit-spending path, so the branches that matter are the ones the
 * integration suite can only reach one at a time by arranging real database state:
 *
 *   · **the hold is reused on a resubmit after CHANGES_REQUESTED** and taken
 *     fresh after a REJECTED — the surviving hold is the only thing separating the
 *     two outcomes (§10), and getting it wrong charges a dealer twice;
 *   · the completeness gate, field by field, including the photo-count message;
 *   · the coherence check on a PATCH, which has to validate the row *as it will
 *     be* rather than as it was sent;
 *   · slug assignment, which must never change once Google has indexed it (§17.1).
 */
const billing = vi.hoisted(() => ({
  balance: 5,
  movements: [] as Record<string, unknown>[],
  heldRefreshes: 0,
  activeRefreshes: 0,
}));

vi.mock('../../../../src/modules/billing/billing.facade.js', async (importOriginal) => {
  const actual = await importOriginal<typeof BillingFacade>();

  return {
    ...actual,
    currentBalance: () => Promise.resolve(billing.balance),
    moveCredits: (_tx: unknown, movement: Record<string, unknown>) => {
      billing.movements.push(movement);
      const before = billing.balance;
      billing.balance += Number(movement.delta);
      return Promise.resolve({
        transactionId: `txn-${billing.movements.length}`,
        balanceBefore: before,
        balanceAfter: billing.balance,
      });
    },
    refreshHeldCount: () => {
      billing.heldRefreshes += 1;
      return Promise.resolve();
    },
    refreshActiveListings: () => {
      billing.activeRefreshes += 1;
      return Promise.resolve();
    },
  };
});

/** Real uuids: `withTenant` refuses to stamp a non-uuid tenant id, by design. */
const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';
const VEHICLE = 'c2a64fc2-9a5a-4eec-a5e8-43db000b7851';
const USER = '7e1a0b3c-5d2f-4a8b-9c6d-1e2f3a4b5c6d';

function vehicle(overrides: Record<string, unknown> = {}): VehicleWithRelations {
  return {
    id: VEHICLE,
    dealerId: DEALER,
    slug: null,
    status: 'DRAFT',
    makeId: 'make-1',
    modelId: 'model-1',
    variantId: 'variant-1',
    year: 2021,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'HATCHBACK',
    kmDriven: 42_180,
    ownerNumber: 1,
    colorId: 'color-1',
    seats: 5,
    airbags: 2,
    rtoCode: 'TN-23',
    cityId: 'city-1',
    regNumberMasked: 'TN23 •• •• 1234',
    insuranceType: 'COMPREHENSIVE',
    insuranceValidTill: new Date('2027-03-01T00:00:00.000Z'),
    priceNegotiable: 'SLIGHTLY',
    pricePaise: 64_500_000n,
    description: 'x'.repeat(120),
    features: ['Sunroof'],
    primaryMediaId: 'media-1',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    make: { name: 'Maruti Suzuki' },
    model: { name: 'Alto 800' },
    variant: { name: 'VXI' },
    color: { name: 'White' },
    city: { slug: 'vellore', name: 'Vellore' },
    media: Array.from({ length: 6 }, (_, index) => ({
      position: index,
      media: {
        id: index === 0 ? 'media-1' : `media-${index + 1}`,
        status: 'READY',
        blurhash: 'L6',
        width: 1600,
        height: 1200,
        fileName: `photo-${index}.jpg`,
        warnings: [],
        uploadedByAdmin: false,
      },
    })),
    listings: [],
    ...overrides,
  } as unknown as VehicleWithRelations;
}

function dealer(overrides: Record<string, unknown> = {}) {
  return {
    id: DEALER,
    status: 'ACTIVE',
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Motors Pvt Ltd',
    gstin: '33AABCS1429B1ZX',
    addressLine: '12 Katpadi Road',
    cityId: 'city-1',
    creditBalance: 39,
    ...overrides,
  };
}

interface Options {
  vehicle?: Record<string, unknown> | null;
  list?: VehicleWithRelations[];
  count?: number;
  dealer?: Record<string, unknown> | null;
  brokenRef?: string | null;
  updated?: Record<string, unknown> | null;
  softDeleted?: boolean;
  minPhotos?: number;
  listing?: Record<string, unknown> | null;
  slugTaken?: number;
}

function setup(options: Options = {}) {
  const listingCreates: Record<string, unknown>[] = [];
  const listingUpdates: Record<string, unknown>[] = [];
  const vehicleUpdates: Record<string, unknown>[] = [];
  const creditTxnUpdates: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const repoUpdates: Record<string, unknown>[] = [];
  const refs: Record<string, unknown>[] = [];
  let slugLookups = 0;

  const row = options.vehicle === null ? null : vehicle(options.vehicle ?? {});

  const repo = {
    findForDealer: () => Promise.resolve(row),
    listForDealer: () => Promise.resolve(options.list ?? []),
    countForDealer: () => Promise.resolve(options.count ?? 0),
    create: (_dealerId: string, data: Record<string, unknown>) =>
      Promise.resolve(vehicle({ ...(options.vehicle ?? {}), ...data })),
    update: (_dealerId: string, _vehicleId: string, data: Record<string, unknown>) => {
      repoUpdates.push(data);
      return Promise.resolve(
        options.updated === null ? null : vehicle({ ...(options.vehicle ?? {}), ...data }),
      );
    },
    softDelete: () => Promise.resolve(options.softDeleted ?? true),
    findBrokenCatalogueRef: (candidate: Record<string, unknown>) => {
      refs.push(candidate);
      return Promise.resolve(options.brokenRef ?? null);
    },
  } as unknown as VehiclesRepository;

  const tx = {
    listing: {
      create: (args: { data: Record<string, unknown> }) => {
        listingCreates.push(args.data);
        return Promise.resolve({
          id: 'listing-new',
          submittedAt: new Date('2026-08-17T10:00:00.000Z'),
          ...args.data,
        });
      },
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        listingUpdates.push(args.data);
        return Promise.resolve({
          id: 'listing-1',
          submittedAt: new Date('2026-08-17T10:00:00.000Z'),
          ...args.data,
        });
      },
    },
    vehicle: {
      update: (args: { data: Record<string, unknown> }) => {
        vehicleUpdates.push(args.data);
        return Promise.resolve({});
      },
      findUnique: () => {
        slugLookups += 1;
        return Promise.resolve(slugLookups <= (options.slugTaken ?? 0) ? { id: 'other' } : null);
      },
    },
    creditTransaction: {
      update: (args: { data: Record<string, unknown> }) => {
        creditTxnUpdates.push(args.data);
        return Promise.resolve({});
      },
    },
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
    $executeRawUnsafe: () => Promise.resolve(1),
  };

  const prisma = {
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
    listing: { findFirst: () => Promise.resolve(options.listing ?? null) },
  } as unknown as PrismaClient;

  const dealers = {
    findById: () => Promise.resolve(options.dealer === null ? null : dealer(options.dealer ?? {})),
  } as unknown as DealersRepository;

  const config = {
    number: (key: string) =>
      Promise.resolve(
        key === 'listing.minPhotos'
          ? (options.minPhotos ?? 6)
          : key === 'listing.reviewSlaHours'
            ? 24
            : 90,
      ),
    boolean: () => Promise.resolve(false),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    invalidate: () => undefined,
  } as unknown as PlatformConfigService;

  return {
    service: createVehiclesService({ prisma, repo, dealers, config }),
    listingCreates,
    listingUpdates,
    vehicleUpdates,
    creditTxnUpdates,
    outbox,
    repoUpdates,
    refs,
  };
}

beforeEach(() => {
  billing.balance = 5;
  billing.movements = [];
  billing.heldRefreshes = 0;
  billing.activeRefreshes = 0;
});

describe('completeness', () => {
  it('reports 100% and no blockers for a finished draft', async () => {
    const h = setup();

    const state = await h.service.completeness(vehicle());

    expect(state).toMatchObject({ percent: 100, missing: [], canSubmit: true, blockers: [] });
  });

  it('names each missing field', async () => {
    const h = setup();

    const state = await h.service.completeness(
      vehicle({ kmDriven: null, ownerNumber: null, colorId: null, pricePaise: null }),
    );

    expect(state.missing).toEqual(['kmDriven', 'ownerNumber', 'colorId', 'pricePaise']);
    expect(state.canSubmit).toBe(false);
  });

  it('treats zero kilometres as present, not missing', async () => {
    const h = setup();

    // `Boolean(0)` is false — a nearly-new car with 0 km must not read as
    // incomplete.
    expect((await h.service.completeness(vehicle({ kmDriven: 0 }))).missing).not.toContain(
      'kmDriven',
    );
  });

  it('requires a description of at least 100 characters', async () => {
    const h = setup();

    const short = await h.service.completeness(vehicle({ description: 'Good car.' }));
    const padded = await h.service.completeness(vehicle({ description: `  ${'x'.repeat(99)}  ` }));

    expect(short.missing).toContain('description');
    // Whitespace does not count towards the minimum.
    expect(padded.missing).toContain('description');
  });

  it('treats a null description as missing', async () => {
    const h = setup();

    expect((await h.service.completeness(vehicle({ description: null }))).missing).toContain(
      'description',
    );
  });

  it('counts only processed photos towards the minimum', async () => {
    const h = setup({ minPhotos: 6 });

    const state = await h.service.completeness(
      vehicle({
        media: [
          ...Array.from({ length: 5 }, () => ({ position: 0, media: { status: 'READY' } })),
          { position: 5, media: { status: 'PENDING' } },
        ],
      }),
    );

    expect(state.missing).toContain('photos');
    expect(state.blockers[0]?.code).toBe('TOO_FEW_PHOTOS');
  });

  it('says exactly how many more photos are needed, pluralised', async () => {
    const h = setup({ minPhotos: 6 });

    const one = await h.service.completeness(
      vehicle({ media: Array.from({ length: 5 }, () => ({ media: { status: 'READY' } })) }),
    );
    const three = await h.service.completeness(
      vehicle({ media: Array.from({ length: 3 }, () => ({ media: { status: 'READY' } })) }),
    );

    expect(one.blockers[0]?.message).toBe('Add 1 more photo (6 required).');
    expect(three.blockers[0]?.message).toBe('Add 3 more photos (6 required).');
  });

  it('reads the minimum from platform config', async () => {
    const h = setup({ minPhotos: 3 });

    const state = await h.service.completeness(
      vehicle({ media: Array.from({ length: 3 }, () => ({ media: { status: 'READY' } })) }),
    );

    expect(state.canSubmit).toBe(true);
  });

  it('lists photos once, as a photo blocker rather than a generic one', async () => {
    const h = setup({ minPhotos: 6 });

    const state = await h.service.completeness(vehicle({ media: [] }));

    expect(state.blockers.filter((blocker) => blocker.code === 'TOO_FEW_PHOTOS')).toHaveLength(1);
    expect(
      state.blockers.some((blocker) => blocker.message.includes('Photos is still missing')),
    ).toBe(false);
  });

  it('labels a missing field in words a dealer recognises', async () => {
    const h = setup();

    const state = await h.service.completeness(vehicle({ pricePaise: null, cityId: null }));

    // Emitted in the order of the required-field list, not the order they were
    // cleared — the wizard walks the dealer down the form.
    expect(state.blockers.map((blocker) => blocker.message)).toEqual([
      'Location is still missing.',
      'Asking price is still missing.',
    ]);
  });

  it('scales the percentage with the number of gaps', async () => {
    const h = setup();

    const state = await h.service.completeness(vehicle({ pricePaise: null }));

    expect(state.percent).toBe(90);
  });
});

describe('toDto', () => {
  it('derives the display status and its label once, here', async () => {
    const h = setup();

    const dto = await h.service.toDto(vehicle({ listings: [{ status: 'APPROVED' }] }));

    expect(dto.displayStatus).toBe('ACTIVE');
    expect(dto.statusLabel.length).toBeGreaterThan(0);
    expect(dto.statusTone.length).toBeGreaterThan(0);
  });

  it('builds the title from year, make, model and variant', async () => {
    const h = setup();

    expect((await h.service.toDto(vehicle())).title).toBe('2021 Maruti Suzuki Alto 800 VXI');
  });

  it('leaves out a variant that is not set', async () => {
    const h = setup();

    expect((await h.service.toDto(vehicle({ variant: null }))).title).toBe(
      '2021 Maruti Suzuki Alto 800',
    );
  });

  it('returns paise as a number and an em dash for an unpriced draft', async () => {
    const h = setup();

    const priced = await h.service.toDto(vehicle());
    const unpriced = await h.service.toDto(vehicle({ pricePaise: null }));

    expect(priced.pricePaise).toBe(64_500_000);
    expect(priced.priceLabel).toBe('₹6.45 Lakh');
    expect(unpriced.pricePaise).toBeNull();
    expect(unpriced.priceLabel).toBe('—');
  });

  it('previews the credit cost against the live balance', async () => {
    const h = setup({ dealer: { creditBalance: 3 } });

    expect((await h.service.toDto(vehicle())).creditPreview).toEqual({
      balance: 3,
      cost: 1,
      balanceAfterPublish: 2,
    });
  });

  it('never previews a negative balance', async () => {
    const h = setup({ dealer: { creditBalance: 0 } });

    expect((await h.service.toDto(vehicle())).creditPreview.balanceAfterPublish).toBe(0);
  });

  it('treats a missing dealership as a zero balance rather than throwing', async () => {
    const h = setup({ dealer: null });

    expect((await h.service.toDto(vehicle())).creditPreview.balance).toBe(0);
  });

  it('marks the primary photo and gives a URL only to processed ones', async () => {
    const h = setup();

    const dto = await h.service.toDto(
      vehicle({
        primaryMediaId: 'media-1',
        media: [
          { position: 0, media: { id: 'media-1', status: 'READY', warnings: [] } },
          { position: 1, media: { id: 'media-2', status: 'PENDING', warnings: [] } },
        ],
      }),
    );

    expect(dto.media[0]).toMatchObject({ mediaId: 'media-1', isPrimary: true, status: 'READY' });
    expect(dto.media[0]?.url).toContain('media-1');
    expect(dto.media[1]).toMatchObject({ isPrimary: false, status: 'PROCESSING', url: null });
  });

  it('counts only processed photos', async () => {
    const h = setup();

    const dto = await h.service.toDto(
      vehicle({
        media: [
          { position: 0, media: { id: 'a', status: 'READY', warnings: [] } },
          { position: 1, media: { id: 'b', status: 'FAILED', warnings: [] } },
        ],
      }),
    );

    expect(dto.photoCount).toBe(1);
  });

  it('surfaces the moderator’s reason and note', async () => {
    const h = setup();

    const dto = await h.service.toDto(
      vehicle({
        listings: [
          {
            status: 'REJECTED',
            rejectionReason: 'Odometer photo does not match.',
            changeRequestNote: null,
          },
        ],
      }),
    );

    expect(dto.rejectionReason).toBe('Odometer photo does not match.');
  });

  it('serialises the insurance expiry as an ISO string, or null', async () => {
    const h = setup();

    expect((await h.service.toDto(vehicle())).insuranceValidTill).toBe('2027-03-01T00:00:00.000Z');
    expect(
      (await h.service.toDto(vehicle({ insuranceValidTill: null }))).insuranceValidTill,
    ).toBeNull();
  });
});

describe('inventory', () => {
  it('maps rows and reports the total count', async () => {
    const h = setup({ list: [vehicle()], count: 7 });

    const response = await h.service.inventory(DEALER, { limit: 24 });

    expect(response.data).toHaveLength(1);
    expect(response.totalCount).toBe(7);
    expect(response.countLabel).toBe('7 vehicles');
  });

  it('pluralises the count label', async () => {
    const h = setup({ count: 1 });

    expect((await h.service.inventory(DEALER, { limit: 24 })).countLabel).toBe('1 vehicle');
  });

  it('returns a cursor only when there is another page', async () => {
    const many = setup({ list: Array.from({ length: 3 }, () => vehicle()) });
    const few = setup({ list: [vehicle()] });

    const paged = await many.service.inventory('dealer-1', { limit: 2 });
    const last = await few.service.inventory('dealer-1', { limit: 2 });

    // The repository fetches limit + 1 to answer "is there more" without a count.
    expect(paged.data).toHaveLength(2);
    expect(paged.page.hasMore).toBe(true);
    expect(paged.page.nextCursor).not.toBeNull();
    expect(last.page.hasMore).toBe(false);
    expect(last.page.nextCursor).toBeNull();
  });

  it('filters by display status after mapping', async () => {
    const h = setup({
      list: [
        vehicle({ id: 'a', listings: [{ status: 'APPROVED' }] }),
        vehicle({ id: 'b', listings: [] }),
      ],
    });

    const response = await h.service.inventory(DEALER, { limit: 24, status: 'DRAFT' });

    // `displayStatus` is derived, not stored, so the filter cannot be a where
    // clause without duplicating the derivation in SQL.
    expect(response.data.map((row) => row.vehicleId)).toEqual(['b']);
  });

  it('raises a banner for a rejected listing, carrying the reason verbatim', async () => {
    const h = setup({
      list: [
        vehicle({
          listings: [
            {
              id: 'listing-1',
              status: 'REJECTED',
              rejectionReason: 'Photos are too few to represent the vehicle.',
            },
          ],
        }),
      ],
    });

    const banner = (await h.service.inventory(DEALER, { limit: 24 })).banner;

    expect(banner).toMatchObject({
      type: 'REJECTED',
      listingId: 'listing-1',
      reason: 'Photos are too few to represent the vehicle.',
      actionLabel: 'Edit & resubmit',
      actionHref: `/dealer/vehicles/${VEHICLE}/edit`,
    });
    expect(banner?.title).toContain('was rejected');
  });

  it('raises a change-request banner with its own wording', async () => {
    const h = setup({
      list: [
        vehicle({
          listings: [
            { id: 'listing-1', status: 'CHANGES_REQUESTED', changeRequestNote: 'Add interior.' },
          ],
        }),
      ],
    });

    const banner = (await h.service.inventory(DEALER, { limit: 24 })).banner;

    expect(banner?.type).toBe('CHANGES_REQUESTED');
    expect(banner?.title).toContain('sent back for changes');
    expect(banner?.reason).toBe('Add interior.');
  });

  it('raises no banner when nothing needs attention', async () => {
    const h = setup({ list: [vehicle({ listings: [{ status: 'APPROVED' }] })] });

    expect((await h.service.inventory(DEALER, { limit: 24 })).banner).toBeNull();
  });

  it('raises no banner for a rejection with no reason recorded', async () => {
    const h = setup({
      list: [vehicle({ listings: [{ id: 'l', status: 'REJECTED', rejectionReason: null }] })],
    });

    // An empty banner would be worse than none — it would say something went
    // wrong and not say what.
    expect((await h.service.inventory(DEALER, { limit: 24 })).banner).toBeNull();
  });

  it('finds the banner across the whole page, not just the filtered rows', async () => {
    const h = setup({
      list: [
        vehicle({ id: 'a', listings: [] }),
        vehicle({
          id: 'b',
          listings: [{ id: 'listing-1', status: 'REJECTED', rejectionReason: 'No.' }],
        }),
      ],
    });

    const response = await h.service.inventory(DEALER, { limit: 24, status: 'DRAFT' });

    // §10: the rejection banner is the one thing a dealer must never have to hunt
    // for — including while looking at a filtered tab.
    expect(response.data).toHaveLength(1);
    expect(response.banner).not.toBeNull();
  });

  describe('the row action flags', () => {
    it('permits editing in every state except pending review', async () => {
      const cases: [string | null, boolean][] = [
        [null, true],
        ['APPROVED', true],
        ['REJECTED', true],
        ['CHANGES_REQUESTED', true],
        ['EXPIRED', true],
        ['PENDING_REVIEW', false],
      ];

      for (const [status, canEdit] of cases) {
        const h = setup({
          list: [
            vehicle({ listings: status ? [{ id: 'l', status, submittedAt: new Date() }] : [] }),
          ],
        });

        const row = (await h.service.inventory(DEALER, { limit: 24 })).data[0];
        expect(row?.canEdit, `${status ?? 'draft'}`).toBe(canEdit);
      }
    });

    it('permits resubmit only after a rejection or a change request', async () => {
      for (const [status, expected] of [
        ['REJECTED', true],
        ['CHANGES_REQUESTED', true],
        ['APPROVED', false],
      ] as const) {
        const h = setup({ list: [vehicle({ listings: [{ id: 'l', status }] })] });

        expect(
          (await h.service.inventory(DEALER, { limit: 24 })).data[0]?.canResubmit,
          status,
        ).toBe(expected);
      }
    });

    it('permits renew only when expired, and mark-sold only when live', async () => {
      const expired = setup({ list: [vehicle({ listings: [{ id: 'l', status: 'EXPIRED' }] })] });
      const live = setup({ list: [vehicle({ listings: [{ id: 'l', status: 'APPROVED' }] })] });

      const expiredRow = (await expired.service.inventory('dealer-1', { limit: 24 })).data[0];
      const liveRow = (await live.service.inventory('dealer-1', { limit: 24 })).data[0];

      expect([expiredRow?.canRenew, expiredRow?.canMarkSold]).toEqual([true, false]);
      expect([liveRow?.canRenew, liveRow?.canMarkSold]).toEqual([false, true]);
    });

    it('refuses deletion of a live car', async () => {
      const live = setup({ list: [vehicle({ listings: [{ id: 'l', status: 'APPROVED' }] })] });
      const draft = setup({ list: [vehicle({ listings: [] })] });

      expect((await live.service.inventory('dealer-1', { limit: 24 })).data[0]?.canDelete).toBe(
        false,
      );
      expect((await draft.service.inventory('dealer-1', { limit: 24 })).data[0]?.canDelete).toBe(
        true,
      );
    });
  });

  it('builds the meta label from whatever it has', async () => {
    const full = setup({ list: [vehicle()] });
    const noKm = setup({ list: [vehicle({ kmDriven: null })] });

    expect((await full.service.inventory('dealer-1', { limit: 24 })).data[0]?.metaLabel).toBe(
      '42,180 km · Petrol',
    );
    // An em dash joined with a separator would render "— · Petrol".
    expect((await noKm.service.inventory('dealer-1', { limit: 24 })).data[0]?.metaLabel).toBe(
      'Petrol',
    );
  });

  it('shows a relative submitted time only while pending', async () => {
    const pending = setup({
      list: [
        vehicle({
          listings: [
            { id: 'l', status: 'PENDING_REVIEW', submittedAt: new Date(Date.now() - 3_600_000) },
          ],
        }),
      ],
    });
    const live = setup({
      list: [vehicle({ listings: [{ id: 'l', status: 'APPROVED', submittedAt: new Date() }] })],
    });

    expect(
      (await pending.service.inventory('dealer-1', { limit: 24 })).data[0]?.submittedLabel,
    ).toBeTruthy();
    expect(
      (await live.service.inventory('dealer-1', { limit: 24 })).data[0]?.submittedLabel,
    ).toBeNull();
  });

  it('shows an expiry date only when there is one', async () => {
    const withExpiry = setup({
      list: [
        vehicle({
          listings: [
            { id: 'l', status: 'APPROVED', expiresAt: new Date('2026-11-15T00:00:00.000Z') },
          ],
        }),
      ],
    });
    const without = setup({ list: [vehicle({ listings: [] })] });

    expect(
      (await withExpiry.service.inventory('dealer-1', { limit: 24 })).data[0]?.expiryLabel,
    ).toBe('15 Nov 2026');
    expect((await without.service.inventory('dealer-1', { limit: 24 })).data[0]?.expiryLabel).toBe(
      '—',
    );
  });

  it('falls back to the first photo when no primary is set', async () => {
    const h = setup({
      list: [
        vehicle({
          primaryMediaId: null,
          media: [{ position: 0, media: { id: 'media-9', status: 'READY', warnings: [] } }],
        }),
      ],
    });

    expect((await h.service.inventory(DEALER, { limit: 24 })).data[0]?.thumbnailUrl).toContain(
      'media-9',
    );
  });

  it('reports a null thumbnail for a car with no photos', async () => {
    const h = setup({ list: [vehicle({ media: [] })] });

    expect((await h.service.inventory(DEALER, { limit: 24 })).data[0]?.thumbnailUrl).toBeNull();
  });

  it('carries views and enquiries from the listing, defaulting to zero', async () => {
    const withCounts = setup({
      list: [
        vehicle({ listings: [{ id: 'l', status: 'APPROVED', viewCount: 40, enquiryCount: 3 }] }),
      ],
    });
    const draft = setup({ list: [vehicle({ listings: [] })] });

    const row = (await withCounts.service.inventory('dealer-1', { limit: 24 })).data[0];
    const draftRow = (await draft.service.inventory('dealer-1', { limit: 24 })).data[0];

    expect([row?.views, row?.enquiries]).toEqual([40, 3]);
    expect([draftRow?.views, draftRow?.enquiries]).toEqual([0, 0]);
  });
});

describe('get', () => {
  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    // §7 layer 4: 404, never 403 — a 403 would confirm the id exists.
    await expect(h.service.get(DEALER, VEHICLE)).rejects.toThrow(NotFoundError);
  });

  it('returns the full DTO for one the dealer owns', async () => {
    const h = setup();

    expect((await h.service.get(DEALER, VEHICLE)).id).toBe(VEHICLE);
  });
});

describe('create', () => {
  const input: CreateVehicleInput = {
    makeId: 'make-1',
    modelId: 'model-1',
    variantId: 'variant-1',
    year: 2021,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'HATCHBACK',
  };

  it('creates a DRAFT scoped to the session’s dealer', async () => {
    const h = setup();

    const dto = await h.service.create(DEALER, input);

    expect(dto.status).toBe('DRAFT');
  });

  it('validates the catalogue references before touching Prisma', async () => {
    const h = setup();

    await h.service.create(DEALER, input);

    expect(h.refs[0]).toEqual({
      makeId: 'make-1',
      modelId: 'model-1',
      variantId: 'variant-1',
    });
  });

  it('404s an unknown reference, naming the field', async () => {
    const h = setup({ brokenRef: 'makeId' });

    try {
      await h.service.create(DEALER, input);
      expect.unreachable('an unknown make must not reach Prisma');
    } catch (error) {
      // The bug this replaced was a 500 with the failing SQL attached — a client
      // mistake reported as a server fault.
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).errors?.[0]).toEqual({
        field: 'makeId',
        code: 'NOT_IN_CATALOGUE',
        message: 'Not a known catalogue entry.',
      });
      expect((error as NotFoundError).detail).toContain('Make is not in the catalogue');
      expect((error as NotFoundError).detail).toContain('GET /v1/catalog/bundle');
    }
  });

  it('names the model and variant too', async () => {
    for (const [field, label] of [
      ['modelId', 'Model'],
      ['variantId', 'Variant'],
      ['colorId', 'Colour'],
      ['cityId', 'Location'],
    ] as const) {
      const h = setup({ brokenRef: field });

      await expect(h.service.create(DEALER, input)).rejects.toThrow(
        new RegExp(`${label} is not in the catalogue`),
      );
    }
  });

  it('treats an absent variant as null rather than leaving it undefined', async () => {
    const h = setup();

    await h.service.create(DEALER, { ...input, variantId: undefined });

    expect(h.refs[0]).toMatchObject({ variantId: null });
  });
});

describe('update', () => {
  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.update(DEALER, VEHICLE, {})).rejects.toThrow(NotFoundError);
  });

  it('refuses an edit while the listing is under review', async () => {
    const h = setup({ vehicle: { listings: [{ id: 'l', status: 'PENDING_REVIEW' }] } });

    await expect(h.service.update(DEALER, VEHICLE, { year: 2022 })).rejects.toThrow(ConflictError);
    await expect(h.service.update(DEALER, VEHICLE, { year: 2022 })).rejects.toThrow(
      /with our team/,
    );
  });

  it('allows an edit while live, rejected or expired', async () => {
    for (const status of ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED']) {
      const h = setup({ vehicle: { listings: [{ id: 'l', status }] } });

      await expect(h.service.update(DEALER, VEHICLE, { year: 2022 })).resolves.toBeDefined();
    }
  });

  it('writes only the fields that were sent', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { kmDriven: 50_000 });

    expect(h.repoUpdates[0]).toEqual({ kmDriven: 50_000 });
  });

  it('converts the price to BigInt paise', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { pricePaise: 64_500_000 });

    // Rule 3: money is integer paise end to end. A float here is the bug that
    // rule exists for.
    expect(h.repoUpdates[0]?.pricePaise).toBe(64_500_000n);
  });

  it('parses an insurance date, and clears it when told to', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { insuranceValidTill: '2027-03-01' });
    await h.service.update(DEALER, VEHICLE, { insuranceValidTill: null });

    expect(h.repoUpdates[0]?.insuranceValidTill).toBeInstanceOf(Date);
    expect(h.repoUpdates[1]?.insuranceValidTill).toBeNull();
  });

  it('normalises optional ids to null when cleared', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, {
      variantId: null,
      colorId: null,
      seats: null,
      airbags: null,
      rtoCode: null,
      regNumberMasked: null,
      insuranceType: null,
      description: null,
    });

    for (const [key, value] of Object.entries(h.repoUpdates[0] ?? {})) {
      expect(value, key).toBeNull();
    }
  });

  it('skips the catalogue check entirely when the taxonomy is untouched', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { kmDriven: 1 });

    // Whatever is stored passed this check on the way in; re-reading it on every
    // wizard step would be three queries to learn nothing.
    expect(h.refs[0]).toEqual({});
  });

  it('checks coherence against the row as it will be, not as it was sent', async () => {
    const h = setup({ vehicle: { makeId: 'make-1', modelId: 'model-1', variantId: 'variant-1' } });

    await h.service.update(DEALER, VEHICLE, { modelId: 'model-2' });

    // A PATCH may move the model without naming the make; the pair that ends up
    // stored is what has to hold together.
    expect(h.refs[0]).toEqual({
      makeId: 'make-1',
      modelId: 'model-2',
      variantId: 'variant-1',
    });
  });

  it('carries a cleared variant into the coherence check', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { variantId: null });

    expect(h.refs[0]).toMatchObject({ variantId: null });
  });

  it('checks colour and city only when they are being changed', async () => {
    const h = setup();

    await h.service.update(DEALER, VEHICLE, { colorId: 'color-2' });

    expect(h.refs[0]).toEqual({ colorId: 'color-2' });
  });

  it('404s a broken reference without writing anything', async () => {
    const h = setup({ brokenRef: 'modelId' });

    await expect(h.service.update(DEALER, VEHICLE, { modelId: 'nope' })).rejects.toThrow(
      NotFoundError,
    );
    expect(h.repoUpdates).toEqual([]);
  });

  it('404s when the row vanished between the read and the write', async () => {
    const h = setup({ updated: null });

    await expect(h.service.update(DEALER, VEHICLE, { year: 2022 })).rejects.toThrow(NotFoundError);
  });
});

describe('remove', () => {
  it('soft-deletes a draft', async () => {
    const h = setup();

    await expect(h.service.remove(DEALER, VEHICLE)).resolves.toBeUndefined();
  });

  it('refuses to delete a live car', async () => {
    const h = setup({ vehicle: { listings: [{ id: 'l', status: 'APPROVED' }] } });

    await expect(h.service.remove(DEALER, VEHICLE)).rejects.toThrow(ConflictError);
    await expect(h.service.remove(DEALER, VEHICLE)).rejects.toThrow(/This car is live/);
  });

  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.remove(DEALER, VEHICLE)).rejects.toThrow(NotFoundError);
  });

  it('404s when the soft delete matched nothing', async () => {
    const h = setup({ softDeleted: false });

    await expect(h.service.remove(DEALER, VEHICLE)).rejects.toThrow(NotFoundError);
  });
});

describe('submit', () => {
  it('holds one credit and creates the listing in one transaction', async () => {
    const h = setup();

    const response = await h.service.submit(DEALER, USER, VEHICLE);

    expect(billing.movements).toHaveLength(1);
    expect(billing.movements[0]).toMatchObject({ delta: -1, reason: 'HOLD_SUBMIT' });
    expect(h.listingCreates[0]).toMatchObject({
      status: 'PENDING_REVIEW',
      creditHeld: true,
      creditTxnId: 'txn-1',
    });
    expect(response.credit).toMatchObject({ held: 1, balanceBefore: 5, balanceAfter: 4 });
  });

  it('links the ledger row to the listing it paid for', async () => {
    const h = setup();

    await h.service.submit(DEALER, USER, VEHICLE);

    // Without this the reconciliation job cannot tell which listing a hold
    // belongs to.
    expect(h.creditTxnUpdates[0]).toEqual({ listingId: 'listing-new' });
  });

  it('moves the vehicle to READY and assigns a slug', async () => {
    const h = setup();

    await h.service.submit(DEALER, USER, VEHICLE);

    expect(h.vehicleUpdates[0]).toMatchObject({ status: 'READY' });
    expect(String(h.vehicleUpdates[0]?.slug)).toBe(
      `2021-maruti-suzuki-alto-800-vxi-vellore-${VEHICLE.slice(0, 6)}`,
    );
  });

  it('keeps a slug that was already assigned', async () => {
    const h = setup({ vehicle: { slug: 'an-old-indexed-slug' } });

    await h.service.submit(DEALER, USER, VEHICLE);

    // §17.1: never 404 a URL Google has indexed, so the slug is assigned once.
    expect(h.vehicleUpdates[0]?.slug).toBe('an-old-indexed-slug');
  });

  it('disambiguates a slug that is already taken', async () => {
    const h = setup({ slugTaken: 1 });

    await h.service.submit(DEALER, USER, VEHICLE);

    expect(String(h.vehicleUpdates[0]?.slug)).toMatch(/-1$/);
  });

  it('refreshes the held count from the ledger', async () => {
    const h = setup();

    await h.service.submit(DEALER, USER, VEHICLE);

    expect(billing.heldRefreshes).toBe(1);
  });

  it('publishes ListingSubmitted in the same transaction', async () => {
    const h = setup();

    await h.service.submit(DEALER, USER, VEHICLE);

    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingSubmitted' });
  });

  it('reuses the surviving hold on a resubmit after CHANGES_REQUESTED', async () => {
    const h = setup({
      vehicle: {
        listings: [
          {
            id: 'listing-1',
            status: 'CHANGES_REQUESTED',
            creditHeld: true,
            creditTxnId: 'txn-original',
          },
        ],
      },
    });

    const response = await h.service.submit(DEALER, USER, VEHICLE);

    // The surviving hold is the *only* thing separating "request changes" from
    // "reject". Charging again would make a dealer pay twice for one listing.
    expect(billing.movements).toEqual([]);
    expect(h.listingUpdates[0]).toMatchObject({ creditTxnId: 'txn-original', creditHeld: true });
    expect(response.credit.balanceBefore).toBe(response.credit.balanceAfter);
  });

  it('takes a fresh hold on a resubmit after a rejection', async () => {
    const h = setup({
      vehicle: {
        listings: [{ id: 'listing-1', status: 'REJECTED', creditHeld: false, creditTxnId: null }],
      },
    });

    await h.service.submit(DEALER, USER, VEHICLE);

    // Rejection released the hold, so the resubmit correctly pays again.
    expect(billing.movements).toHaveLength(1);
  });

  it('clears the moderator’s note when resubmitting', async () => {
    const h = setup({
      vehicle: {
        listings: [
          { id: 'listing-1', status: 'CHANGES_REQUESTED', creditHeld: true, creditTxnId: 't' },
        ],
      },
    });

    await h.service.submit(DEALER, USER, VEHICLE);

    expect(h.listingUpdates[0]).toMatchObject({
      rejectionReason: null,
      changeRequestNote: null,
      reviewedAt: null,
      reviewedBy: null,
    });
  });

  it('refuses when the balance is zero', async () => {
    billing.balance = 0;
    const h = setup();

    await expect(h.service.submit(DEALER, USER, VEHICLE)).rejects.toThrow(/credit/i);
    expect(h.listingCreates).toEqual([]);
  });

  it('refuses a dealership that is not ACTIVE', async () => {
    const h = setup({ dealer: { status: 'PENDING_APPROVAL' } });

    try {
      await h.service.submit(DEALER, USER, VEHICLE);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).code).toBe('DEALER_NOT_ACTIVE');
    }
  });

  it('404s a dealership that no longer exists', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.submit(DEALER, USER, VEHICLE)).rejects.toThrow(NotFoundError);
  });

  it('refuses when the dealership profile is incomplete, naming each gap', async () => {
    const h = setup({ dealer: { gstin: null, addressLine: null, cityId: null } });

    try {
      await h.service.submit(DEALER, USER, VEHICLE);
      expect.unreachable();
    } catch (error) {
      const domain = error as DomainError;
      expect(domain.code).toBe('PROFILE_INCOMPLETE');
      expect((domain.errors ?? []).map((entry) => entry.field)).toEqual([
        'gstin',
        'addressLine',
        'cityId_dealer',
      ]);
      expect(domain.errors?.[0]?.message).toContain('GSTIN is required');
    }
  });

  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.submit(DEALER, USER, VEHICLE)).rejects.toThrow(NotFoundError);
  });

  it('refuses a vehicle that already has a live or pending listing', async () => {
    for (const status of ['PENDING_REVIEW', 'APPROVED']) {
      const h = setup({ vehicle: { listings: [{ id: 'l', status }] } });

      await expect(h.service.submit(DEALER, USER, VEHICLE)).rejects.toThrow(
        /already has a live listing/,
      );
    }
  });

  it('reports TOO_FEW_PHOTOS before the generic incompleteness error', async () => {
    const h = setup({ vehicle: { media: [] } });

    try {
      await h.service.submit(DEALER, USER, VEHICLE);
      expect.unreachable();
    } catch (error) {
      // The photo count is the most common reason a submit fails, and a specific
      // code lets the wizard scroll to the uploader.
      expect((error as DomainError).code).toBe('TOO_FEW_PHOTOS');
      expect((error as DomainError).errors?.[0]?.field).toBe('photos');
    }
  });

  it('reports VEHICLE_INCOMPLETE with each missing field', async () => {
    const h = setup({ vehicle: { pricePaise: null, description: null } });

    try {
      await h.service.submit(DEALER, USER, VEHICLE);
      expect.unreachable();
    } catch (error) {
      const domain = error as DomainError;
      expect(domain.code).toBe('VEHICLE_INCOMPLETE');
      expect((domain.errors ?? []).map((entry) => entry.field)).toEqual([
        'pricePaise',
        'description',
      ]);
    }
  });

  it('takes no credit when a guard refuses', async () => {
    const h = setup({ vehicle: { media: [] } });

    await expect(h.service.submit(DEALER, USER, VEHICLE)).rejects.toThrow(DomainError);
    expect(billing.movements).toEqual([]);
  });

  it('promises a review within the configured SLA and states the listing duration', async () => {
    const h = setup();

    const response = await h.service.submit(DEALER, USER, VEHICLE);

    expect(response.message).toContain('within 24 hours');
    expect(response.credit.note).toContain('90 days');
    expect(new Date(response.expectedReviewBy).getTime()).toBeGreaterThan(Date.now());
  });

  it('explains the credit lifecycle in the response', async () => {
    const h = setup();

    const note = (await h.service.submit(DEALER, USER, VEHICLE)).credit.note;

    // The dealer is being charged; the response has to say what happens on
    // approval and on rejection.
    expect(note).toContain('held now');
    expect(note).toContain('spent when the listing is approved');
    expect(note).toContain('the credit returns to your balance');
  });
});

describe('markSold', () => {
  const live = { listings: [{ id: 'listing-1', status: 'APPROVED' }] };

  it('marks the listing and the vehicle sold', async () => {
    const h = setup({ vehicle: live });

    const response = await h.service.markSold(DEALER, VEHICLE, {});

    expect(h.listingUpdates[0]).toMatchObject({ status: 'SOLD' });
    expect(h.vehicleUpdates[0]).toMatchObject({ status: 'SOLD' });
    expect(response.displayStatus).toBe('SOLD');
  });

  it('never refunds the credit — the listing did its job', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, {});

    expect(billing.movements).toEqual([]);
  });

  it('records the sale price when given one, in paise', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, { soldPricePaise: 62_000_000 });

    expect(h.vehicleUpdates[0]?.soldPricePaise).toBe(62_000_000n);
  });

  it('omits the sale price when not given', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, {});

    expect(h.vehicleUpdates[0]).not.toHaveProperty('soldPricePaise');
  });

  it('honours a back-dated sale', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, { soldAt: '2026-08-01T00:00:00.000Z' });

    expect((h.listingUpdates[0]?.soldAt as Date).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('defaults the sale date to now', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, {});

    expect(h.listingUpdates[0]?.soldAt).toBeInstanceOf(Date);
  });

  it('recomputes the dealership’s active count and pulls the car from the catalogue', async () => {
    const h = setup({ vehicle: live });

    await h.service.markSold(DEALER, VEHICLE, {});

    expect(billing.activeRefreshes).toBe(1);
    expect(h.outbox[0]).toMatchObject({ eventType: 'VehicleSold' });
  });

  it('refuses a vehicle that was never published', async () => {
    const h = setup({ vehicle: { listings: [] } });

    await expect(h.service.markSold(DEALER, VEHICLE, {})).rejects.toThrow(/never been published/);
  });

  it('refuses a state the transition table forbids', async () => {
    const h = setup({ vehicle: { listings: [{ id: 'l', status: 'PENDING_REVIEW' }] } });

    await expect(h.service.markSold(DEALER, VEHICLE, {})).rejects.toThrow(ConflictError);
  });

  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.markSold(DEALER, VEHICLE, {})).rejects.toThrow(NotFoundError);
  });
});

describe('renew', () => {
  const expired = {
    id: 'listing-1',
    dealerId: DEALER,
    vehicleId: VEHICLE,
    status: 'EXPIRED',
    vehicle: {
      year: 2021,
      make: { name: 'Maruti Suzuki' },
      model: { name: 'Alto 800' },
      variant: { name: 'VXI' },
    },
  };

  it('costs a fresh credit and re-enters review', async () => {
    const h = setup({ listing: expired });

    const response = await h.service.renew(DEALER, USER, 'listing-1');

    // §10: never straight to APPROVED — 90-day-old photos and a 90-day-old price
    // both deserve a second look.
    expect(billing.movements[0]).toMatchObject({ delta: -1, reason: 'HOLD_SUBMIT' });
    expect(h.listingCreates[0]).toMatchObject({
      status: 'PENDING_REVIEW',
      renewedFromId: 'listing-1',
      creditHeld: true,
    });
    expect(response.status).toBe('PENDING_REVIEW');
    expect(response.renewedFromId).toBe('listing-1');
  });

  it('creates a new listing rather than reviving the old row', async () => {
    const h = setup({ listing: expired });

    await h.service.renew(DEALER, USER, 'listing-1');

    expect(h.listingUpdates).toEqual([]);
    expect(h.listingCreates).toHaveLength(1);
  });

  it('labels the movement so the ledger reads as a renewal', async () => {
    const h = setup({ listing: expired });

    await h.service.renew(DEALER, USER, 'listing-1');

    expect(String(billing.movements[0]?.label)).toBe(
      'Renewal submitted — 2021 Maruti Suzuki Alto 800 VXI',
    );
  });

  it('links the ledger row to the new listing and refreshes the held count', async () => {
    const h = setup({ listing: expired });

    await h.service.renew(DEALER, USER, 'listing-1');

    expect(h.creditTxnUpdates[0]).toEqual({ listingId: 'listing-new' });
    expect(billing.heldRefreshes).toBe(1);
  });

  it('refuses when the balance is zero', async () => {
    billing.balance = 0;
    const h = setup({ listing: expired });

    await expect(h.service.renew(DEALER, USER, 'listing-1')).rejects.toThrow(/credit/i);
    expect(h.listingCreates).toEqual([]);
  });

  it('refuses to renew a listing that has not expired', async () => {
    const h = setup({ listing: { ...expired, status: 'APPROVED' } });

    await expect(h.service.renew(DEALER, USER, 'listing-1')).rejects.toThrow(ConflictError);
  });

  it('404s a listing that does not belong to the dealership', async () => {
    const h = setup({ listing: null });

    await expect(h.service.renew(DEALER, USER, 'listing-1')).rejects.toThrow(NotFoundError);
  });

  it('publishes ListingSubmitted for the renewal', async () => {
    const h = setup({ listing: expired });

    await h.service.renew(DEALER, USER, 'listing-1');

    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingSubmitted' });
  });

  it('tells the dealer the renewal is reviewed again', async () => {
    const h = setup({ listing: expired });

    expect((await h.service.renew(DEALER, USER, 'listing-1')).message).toContain('reviewed again');
  });
});
