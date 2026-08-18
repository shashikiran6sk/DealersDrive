import type { PrismaClient } from '@prisma/client';
import type * as BillingFacade from '../../../../src/modules/billing/billing.facade.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';
import type { AdminPrincipal } from '../../../../src/modules/auth/auth.facade.js';
import { createAdminService } from '../../../../src/modules/admin/admin.service.js';
import type { AuditService } from '../../../../src/platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import {
  ConflictError,
  type DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../../../src/platform/errors.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/admin/admin.service.ts`.
 *
 * The moderation path decides what happens to a dealer's money, so the three
 * credit outcomes are the centre of this file — and they differ only in the
 * ledger row they write:
 *
 *   · **approve** → `CONSUME_APPROVE` with **delta 0**, and still a row, because
 *     the dealer needs to see "Listing published — …" in their history on the day
 *     it happened, at the balance it happened at (§26.3);
 *   · **reject** → `RELEASE_REJECT`, +1, the credit comes back;
 *   · **request changes** → **no row at all**, the hold survives. That is the
 *     entire difference between the two, and it is worth its own test.
 *
 * The permission table gets exhaustive coverage for the same reason: every admin
 * action is one `assertPermission` away from being available to a support seat.
 */
const billing = vi.hoisted(() => ({
  balance: 39,
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
      billing.balance += Number(movement.delta);
      return Promise.resolve({
        transactionId: `txn-${billing.movements.length}`,
        balanceBefore: billing.balance - Number(movement.delta),
        balanceAfter: billing.balance,
      });
    },
    refreshHeldCount: () => {
      billing.heldRefreshes += 1;
      return Promise.resolve(0);
    },
    refreshActiveListings: () => {
      billing.activeRefreshes += 1;
      return Promise.resolve(0);
    },
  };
});

const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';
const LISTING = 'dc3dfaaa-6daf-44f7-86de-28e9716e53a6';

const ALL_PERMISSIONS = [
  'admin:dealer:approve',
  'admin:document:review',
  'admin:credit:grant',
  'admin:listing:moderate',
  'admin:payment:read',
  'admin:config:write',
  'admin:audit:read',
];

function principal(permissions: string[] = ALL_PERMISSIONS): AdminPrincipal {
  return {
    kind: 'ADMIN',
    userId: 'admin-1',
    email: 'ops@dealers-drive.in',
    adminRole: 'SUPER_ADMIN',
    permissions,
  } as unknown as AdminPrincipal;
}

function vehicleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vehicle-1',
    year: 2021,
    slug: '2021-alto-800-vellore-abc123',
    pricePaise: 64_500_000n,
    kmDriven: 42_180,
    fuel: 'PETROL',
    transmission: 'MANUAL',
    bodyType: 'HATCHBACK',
    ownerNumber: 1,
    description: 'Well maintained, single owner.',
    primaryMediaId: 'media-1',
    status: 'READY',
    make: { name: 'Maruti Suzuki' },
    model: { name: 'Alto 800' },
    variant: { name: 'VXI' },
    color: { name: 'White' },
    city: { name: 'Vellore' },
    media: Array.from({ length: 6 }, (_, index) => ({
      position: index,
      media: { id: index === 0 ? 'media-1' : `media-${index}`, status: 'READY', fileName: null },
    })),
    ...overrides,
  };
}

function dealerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEALER,
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    legalName: 'Sri Lakshmi Motors Pvt Ltd',
    status: 'ACTIVE',
    statusReason: null,
    gstin: '33AABCS1429B1ZX',
    pan: 'AABCS1429B',
    addressLine: '12 Katpadi Road',
    contactPhone: '9840012345',
    contactEmail: 'contact@sri-lakshmi-motors.in',
    creditBalance: 39,
    creditsHeld: 2,
    approvedAt: new Date('2026-01-05T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    city: { name: 'Vellore', slug: 'vellore' },
    documents: [],
    members: [{ user: { fullName: 'Ramesh Kumar', email: 'owner@sri-lakshmi-motors.in' } }],
    _count: { vehicles: 12, enquiries: 30 },
    ...overrides,
  };
}

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING,
    dealerId: DEALER,
    vehicleId: 'vehicle-1',
    status: 'PENDING_REVIEW',
    creditHeld: true,
    creditTxnId: 'txn-original',
    submittedAt: new Date('2026-08-17T08:00:00.000Z'),
    dealer: dealerRow(),
    vehicle: vehicleRow(),
    ...overrides,
  };
}

interface Options {
  dealer?: Record<string, unknown> | null;
  dealers?: Record<string, unknown>[];
  listing?: Record<string, unknown> | null;
  listings?: Record<string, unknown>[];
  document?: Record<string, unknown> | null;
  documents?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  auditRows?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  counts?: number[];
  oldest?: Record<string, unknown> | null;
  capturedSum?: bigint | null;
  capturedCount?: number;
  ledger?: Record<string, unknown>[];
  grouped?: { status: string; _count: { _all: number } }[];
  activeCounts?: { dealerId: string; _count: { _all: number } }[];
  configEntries?: { key: string; label: string; type: string; value: unknown }[];
  minPhotos?: number;
  gstPercent?: number;
  presets?: string[];
}

function setup(options: Options = {}) {
  const dealerUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const listingUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const documentUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const audits: Record<string, unknown>[] = [];
  const detachedAudits: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const configWrites: { key: string; value: unknown; by: string | null }[] = [];
  const signedUrls: string[] = [];
  const counts = [...(options.counts ?? [])];

  const nextCount = () => Promise.resolve(counts.length > 0 ? (counts.shift() ?? 0) : 0);

  const tx = {
    dealer: {
      findUnique: () =>
        Promise.resolve(options.dealer === null ? null : dealerRow(options.dealer ?? {})),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        dealerUpdates.push(args);
        return Promise.resolve(dealerRow({ ...(options.dealer ?? {}), ...args.data }));
      },
    },
    listing: {
      findUnique: () =>
        Promise.resolve(options.listing === null ? null : listingRow(options.listing ?? {})),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        listingUpdates.push(args);
        return Promise.resolve({});
      },
      count: nextCount,
    },
    dealerDocument: {
      findUnique: () =>
        Promise.resolve(
          options.document === null
            ? null
            : (options.document ?? {
                id: 'doc-1',
                dealerId: DEALER,
                type: 'GST_CERTIFICATE',
                status: 'UPLOADED',
              }),
        ),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        documentUpdates.push(args);
        return Promise.resolve({});
      },
      findMany: () => Promise.resolve(options.documents ?? []),
    },
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
    creditTransaction: { findFirst: () => Promise.resolve({ balanceAfter: billing.balance }) },
    $executeRawUnsafe: () => Promise.resolve(1),
  };

  const prisma = {
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
    dealer: {
      count: nextCount,
      findMany: () => Promise.resolve(options.dealers ?? []),
      findUnique: () =>
        Promise.resolve(options.dealer === null ? null : dealerRow(options.dealer ?? {})),
      groupBy: () => Promise.resolve(options.grouped ?? []),
    },
    listing: {
      count: nextCount,
      findFirst: () => Promise.resolve(options.oldest ?? null),
      findMany: () => Promise.resolve(options.listings ?? []),
      findUnique: () =>
        Promise.resolve(options.listing === null ? null : listingRow(options.listing ?? {})),
      groupBy: () => Promise.resolve(options.activeCounts ?? []),
    },
    payment: {
      aggregate: () =>
        Promise.resolve({
          _sum: { amountPaise: options.capturedSum ?? null },
          _count: { _all: options.capturedCount ?? 0 },
        }),
      findMany: () => Promise.resolve(options.payments ?? []),
    },
    enquiry: { count: nextCount },
    creditTransaction: { findMany: () => Promise.resolve(options.ledger ?? []) },
    auditLog: { findMany: () => Promise.resolve(options.auditRows ?? []) },
    user: { findMany: () => Promise.resolve(options.users ?? []) },
  } as unknown as PrismaClient;

  const audit = {
    record: (_tx: unknown, entry: Record<string, unknown>) => {
      audits.push(entry);
      return Promise.resolve();
    },
    recordDetached: (entry: Record<string, unknown>) => {
      detachedAudits.push(entry);
      return Promise.resolve();
    },
  } as unknown as AuditService;

  const config = {
    number: (key: string) =>
      Promise.resolve(
        key === 'listing.minPhotos'
          ? (options.minPhotos ?? 6)
          : key === 'billing.gstPercent'
            ? (options.gstPercent ?? 18)
            : 90,
      ),
    stringList: () => Promise.resolve(options.presets ?? ['Photos are too few.']),
    boolean: () => Promise.resolve(false),
    all: () =>
      Promise.resolve(
        options.configEntries ?? [
          { key: 'listing.minPhotos', label: 'Minimum photos', type: 'number', value: 6 },
        ],
      ),
    set: (key: string, value: unknown, by: string | null) => {
      configWrites.push({ key, value, by });
      return Promise.resolve({ key, label: 'Minimum photos', type: 'number', value });
    },
    invalidate: () => undefined,
  } as unknown as PlatformConfigService;

  const storage = {
    signedReadUrl: (key: string) => {
      signedUrls.push(key);
      return `https://storage.test/private/${key}?signed`;
    },
  } as unknown as StoragePort;

  return {
    service: createAdminService({ prisma, audit, config, storage }),
    dealerUpdates,
    listingUpdates,
    documentUpdates,
    audits,
    detachedAudits,
    outbox,
    configWrites,
    signedUrls,
  };
}

beforeEach(() => {
  billing.balance = 39;
  billing.movements = [];
  billing.heldRefreshes = 0;
  billing.activeRefreshes = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the permission table', () => {
  const actions: [
    string,
    (service: ReturnType<typeof setup>['service'], admin: AdminPrincipal) => Promise<unknown>,
  ][] = [
    ['admin:dealer:approve', (s, a) => s.approveDealer(a, DEALER, {})],
    ['admin:dealer:approve', (s, a) => s.rejectDealer(a, DEALER, 'no')],
    ['admin:dealer:approve', (s, a) => s.suspendDealer(a, DEALER, 'no')],
    ['admin:dealer:approve', (s, a) => s.reinstateDealer(a, DEALER)],
    ['admin:document:review', (s, a) => s.verifyDocument(a, 'doc-1')],
    ['admin:document:review', (s, a) => s.rejectDocument(a, 'doc-1', 'blurry')],
    ['admin:credit:grant', (s, a) => s.grantCredits(a, DEALER, { credits: 5, label: 'x' })],
    ['admin:listing:moderate', (s, a) => s.approveListing(a, LISTING)],
    ['admin:listing:moderate', (s, a) => s.rejectListing(a, LISTING, 'no')],
    ['admin:listing:moderate', (s, a) => s.requestChanges(a, LISTING, 'note')],
    [
      'admin:listing:moderate',
      (s, a) => s.takedown(a, LISTING, { reason: 'x', refundCredit: false }),
    ],
    ['admin:payment:read', (s, a) => s.payments(a, { limit: 24 })],
    ['admin:config:write', (s, a) => s.setConfig(a, 'listing.minPhotos', 8)],
    ['admin:audit:read', (s, a) => s.auditLogs(a, { limit: 24 })],
  ];

  it.each(actions)('refuses %s without the permission', async (permission, call) => {
    const h = setup();
    const withoutIt = principal(ALL_PERMISSIONS.filter((entry) => entry !== permission));

    // §8.3: the permission table is only meaningfully tested from a seat that
    // lacks the permission.
    await expect(call(h.service, withoutIt)).rejects.toThrow(ForbiddenError);
    await expect(call(h.service, withoutIt)).rejects.toThrow(permission);
  });

  it('writes nothing when a permission check refuses', async () => {
    const h = setup();
    const support = principal([]);

    await expect(h.service.approveListing(support, LISTING)).rejects.toThrow(ForbiddenError);

    expect([h.listingUpdates, h.audits, h.outbox, billing.movements]).toEqual([[], [], [], []]);
  });
});

describe('overview', () => {
  it('reports the six platform stats', async () => {
    const h = setup({ counts: [12, 3, 40, 7, 5], capturedSum: 1_00_000_00n });

    const overview = await h.service.overview();

    expect(overview.stats.map((stat) => stat.key)).toEqual([
      'totalDealers',
      'pendingVerification',
      'activeListings',
      'payments30d',
      'revenue30d',
      'newEnquiries',
    ]);
  });

  it('separates gross captured from revenue net of GST', async () => {
    const h = setup({ counts: [0, 0, 0, 0, 0], capturedSum: 11_800_000n, gstPercent: 18 });

    const overview = await h.service.overview();
    const gross = overview.stats.find((stat) => stat.key === 'payments30d');
    const net = overview.stats.find((stat) => stat.key === 'revenue30d');

    // Different on purpose: money collected is not money earned.
    expect(gross?.value).toBe(11_800_000);
    expect(net?.value).toBe(10_000_000);
  });

  it('reports zero revenue when nothing was captured', async () => {
    const h = setup({ counts: [0, 0, 0, 0, 0], capturedSum: null });

    const overview = await h.service.overview();

    expect(overview.stats.find((stat) => stat.key === 'payments30d')?.value).toBe(0);
  });

  it('compacts large rupee figures for the stat boxes', async () => {
    const lakhs = setup({ counts: [0, 0, 0, 0, 0], capturedSum: 42_000_000n });
    const crores = setup({ counts: [0, 0, 0, 0, 0], capturedSum: 2_500_000_000n });
    const small = setup({ counts: [0, 0, 0, 0, 0], capturedSum: 50_000n });

    expect(
      (await lakhs.service.overview()).stats.find((stat) => stat.key === 'payments30d')?.valueLabel,
    ).toBe('₹4.2 L');
    expect(
      (await crores.service.overview()).stats.find((stat) => stat.key === 'payments30d')
        ?.valueLabel,
    ).toBe('₹2.5 Cr');
    expect(
      (await small.service.overview()).stats.find((stat) => stat.key === 'payments30d')?.valueLabel,
    ).toBe('₹500');
  });

  it('links the pending-verification stat straight to its filter', async () => {
    const h = setup({ counts: [0, 3, 0, 0, 0] });

    expect(
      (await h.service.overview()).stats.find((stat) => stat.key === 'pendingVerification')?.href,
    ).toBe('/admin/dealers?status=PENDING_APPROVAL');
  });

  it('describes the moderation queue, pluralised, with the oldest wait', async () => {
    const many = setup({
      counts: [0, 0, 0, 0, 3],
      oldest: { submittedAt: new Date(Date.now() - 4 * 3_600_000) },
    });
    const one = setup({
      counts: [0, 0, 0, 0, 1],
      oldest: { submittedAt: new Date(Date.now() - 3_600_000) },
    });

    const manyQueue = (await many.service.overview()).moderationQueue;
    const oneQueue = (await one.service.overview()).moderationQueue;

    expect(manyQueue.message).toMatch(/^3 listings submitted by dealers are waiting/);
    expect(manyQueue.message).toContain('Oldest has been waiting');
    expect(oneQueue.message).toMatch(/^1 listing submitted by dealers is waiting/);
  });

  it('says so plainly when the queue is empty', async () => {
    const h = setup({ counts: [0, 0, 0, 0, 0], oldest: null });

    const overview = await h.service.overview();

    expect(overview.moderationQueue.message).toBe('No listings are waiting for review.');
    expect(overview.moderationQueue.oldestWaitingLabel).toBe('—');
    expect(overview.headerBadge.tone).toBe('neutral');
  });

  it('warns in the header badge while anything is waiting', async () => {
    const h = setup({ counts: [0, 0, 0, 0, 2], oldest: { submittedAt: new Date() } });

    const badge = (await h.service.overview()).headerBadge;

    expect(badge).toMatchObject({ count: 2, label: '2 awaiting review', tone: 'warn' });
  });
});

describe('dealers', () => {
  it('lists dealerships with their live counts and status labels', async () => {
    const h = setup({
      dealers: [dealerRow()],
      activeCounts: [{ dealerId: DEALER, _count: { _all: 7 } }],
      grouped: [{ status: 'ACTIVE', _count: { _all: 4 } }],
    });

    const response = await h.service.dealers({ limit: 24 });

    expect(response.data[0]).toMatchObject({
      brandName: 'Sri Lakshmi Motors',
      initials: 'SL',
      city: 'Vellore',
      vehicleCount: 12,
      activeCount: 7,
      creditBalance: 39,
    });
    expect(response.counts).toEqual({ ACTIVE: 4 });
  });

  it('reports zero active listings for a dealership with none', async () => {
    const h = setup({ dealers: [dealerRow()], activeCounts: [] });

    expect((await h.service.dealers({ limit: 24 })).data[0]?.activeCount).toBe(0);
  });

  it('shows an em dash for a dealership with no city', async () => {
    const h = setup({ dealers: [dealerRow({ city: null })] });

    expect((await h.service.dealers({ limit: 24 })).data[0]?.city).toBe('—');
  });

  it('reports documents verified only when all three are', async () => {
    const all = setup({
      dealers: [
        dealerRow({
          documents: [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        }),
      ],
    });
    const some = setup({
      dealers: [
        dealerRow({
          documents: [{ status: 'VERIFIED' }, { status: 'UPLOADED' }, { status: 'VERIFIED' }],
        }),
      ],
    });
    const two = setup({
      dealers: [dealerRow({ documents: [{ status: 'VERIFIED' }, { status: 'VERIFIED' }] })],
    });

    expect((await all.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(true);
    expect((await some.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(false);
    // Two verified documents is not three.
    expect((await two.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(false);
  });

  it('paginates on the join date', async () => {
    const h = setup({ dealers: [dealerRow(), dealerRow({ id: 'b' }), dealerRow({ id: 'c' })] });

    const response = await h.service.dealers({ limit: 2 });

    expect(response.data).toHaveLength(2);
    expect(response.page.hasMore).toBe(true);
    expect(response.page.nextCursor).not.toBeNull();
  });
});

describe('dealerDetail', () => {
  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.dealerDetail(principal(), DEALER)).rejects.toThrow(NotFoundError);
  });

  it('issues a short-lived signed URL for a readable document', async () => {
    const h = setup({
      dealer: dealerRow({
        documents: [
          { id: 'doc-1', type: 'GST_CERTIFICATE', status: 'UPLOADED', createdAt: new Date() },
        ],
      }),
    });

    const detail = await h.service.dealerDetail(principal(), DEALER);

    expect(detail.documents[0]?.viewUrl).toContain('kyc/');
    expect(detail.documents[0]?.viewUrlExpiresAt).not.toBeNull();
    expect(h.signedUrls[0]).toBe(`kyc/${DEALER}/GST_CERTIFICATE/doc-1`);
  });

  it('issues no URL for a document that was never uploaded', async () => {
    const h = setup({
      dealer: dealerRow({
        documents: [
          { id: 'doc-1', type: 'PAN_CARD', status: 'REQUIRED', createdAt: new Date() },
          { id: 'doc-2', type: 'ADDRESS_PROOF', status: 'REJECTED', createdAt: new Date() },
        ],
      }),
    });

    const detail = await h.service.dealerDetail(principal(), DEALER);

    expect(detail.documents.every((doc) => doc.viewUrl === null)).toBe(true);
    expect(h.signedUrls).toEqual([]);
  });

  it('audit-logs the view whenever a URL is issued', async () => {
    const h = setup({
      dealer: dealerRow({
        documents: [
          { id: 'doc-1', type: 'GST_CERTIFICATE', status: 'VERIFIED', createdAt: new Date() },
        ],
      }),
    });

    await h.service.dealerDetail(principal(), DEALER);

    // §26.6: every signed document URL issued is audit-logged with the admin's
    // identity — that is the whole access control on KYC media.
    expect(h.detachedAudits[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'dealer.documents.viewed',
      entityId: DEALER,
    });
  });

  it('logs nothing when no document could be viewed', async () => {
    const h = setup({ dealer: dealerRow({ documents: [] }) });

    await h.service.dealerDetail(principal(), DEALER);

    expect(h.detachedAudits).toEqual([]);
  });

  it('permits approval only for a pending dealership with all documents verified', async () => {
    const ready = setup({
      dealer: dealerRow({
        status: 'PENDING_APPROVAL',
        documents: [
          { id: 'a', type: 'GST_CERTIFICATE', status: 'VERIFIED', createdAt: new Date() },
          { id: 'b', type: 'PAN_CARD', status: 'VERIFIED', createdAt: new Date() },
          { id: 'c', type: 'ADDRESS_PROOF', status: 'VERIFIED', createdAt: new Date() },
        ],
      }),
    });
    const unverified = setup({
      dealer: dealerRow({
        status: 'PENDING_APPROVAL',
        documents: [
          { id: 'a', type: 'GST_CERTIFICATE', status: 'UPLOADED', createdAt: new Date() },
        ],
      }),
    });

    expect((await ready.service.dealerDetail(principal(), DEALER)).actions.canApprove).toBe(true);
    expect((await unverified.service.dealerDetail(principal(), DEALER)).actions.canApprove).toBe(
      false,
    );
  });

  it('offers suspend for an active dealership and reinstate for a suspended one', async () => {
    const active = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });
    const suspended = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    const activeActions = (await active.service.dealerDetail(principal(), DEALER)).actions;
    const suspendedActions = (await suspended.service.dealerDetail(principal(), DEALER)).actions;

    expect([activeActions.canSuspend, activeActions.canReinstate]).toEqual([true, false]);
    expect([suspendedActions.canSuspend, suspendedActions.canReinstate]).toEqual([false, true]);
  });

  it('gates the credit-grant action on the permission', async () => {
    const h = setup();

    const withIt = await h.service.dealerDetail(principal(), DEALER);
    const withoutIt = await h.service.dealerDetail(principal([]), DEALER);

    expect(withIt.actions.canGrantCredits).toBe(true);
    expect(withoutIt.actions.canGrantCredits).toBe(false);
  });

  it('formats the contact number, or reports null when there is none', async () => {
    const withPhone = setup();
    const without = setup({ dealer: dealerRow({ contactPhone: null }) });

    expect((await withPhone.service.dealerDetail(principal(), DEALER)).contactPhoneDisplay).toBe(
      '+91 98400 12345',
    );
    expect(
      (await without.service.dealerDetail(principal(), DEALER)).contactPhoneDisplay,
    ).toBeNull();
  });

  it('signs the recent ledger entries for display', async () => {
    const h = setup({
      ledger: [
        { id: 't1', delta: 10, label: 'Purchased', createdAt: new Date(), balanceAfter: 49 },
        { id: 't2', delta: -1, label: 'Submitted', createdAt: new Date(), balanceAfter: 48 },
        { id: 't3', delta: 0, label: 'Published', createdAt: new Date(), balanceAfter: 48 },
      ],
    });

    const detail = await h.service.dealerDetail(principal(), DEALER);

    expect(detail.recentLedger.map((row) => row.deltaLabel)).toEqual(['+10', '−1', '0']);
  });
});

describe('approveDealer', () => {
  it('activates the dealership and clears any status reason', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL', statusReason: 'Waiting' }) });

    const response = await h.service.approveDealer(principal(), DEALER, {});

    expect(h.dealerUpdates[0]?.data).toMatchObject({ status: 'ACTIVE', statusReason: null });
    expect(h.dealerUpdates[0]?.data.approvedAt).toBeInstanceOf(Date);
    expect(response.status).toBe('ACTIVE');
  });

  it('grants an onboarding bonus when asked', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    const response = await h.service.approveDealer(principal(), DEALER, { grantCredits: 5 });

    expect(billing.movements[0]).toMatchObject({ delta: 5, reason: 'ADMIN_GRANT' });
    expect(response.creditsGranted).toBe(5);
    expect(response.creditBalance).toBe(44);
  });

  it('labels the grant with the admin’s note', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(principal(), DEALER, { grantCredits: 5, note: 'Launch offer' });

    expect(billing.movements[0]?.label).toBe('Admin grant — Launch offer');
  });

  it('falls back to a default label', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(principal(), DEALER, { grantCredits: 5 });

    expect(billing.movements[0]?.label).toBe('Admin grant — onboarding bonus');
  });

  it('grants nothing when no bonus was asked for, or the number is zero', async () => {
    for (const input of [{}, { grantCredits: 0 }]) {
      billing.movements = [];
      const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

      const response = await h.service.approveDealer(principal(), DEALER, input);

      expect(billing.movements).toEqual([]);
      expect(response.creditsGranted).toBe(0);
    }
  });

  it('refuses to approve a dealership that is already active', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });

    try {
      await h.service.approveDealer(principal(), DEALER, {});
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('ALREADY_ACTIVE');
    }
    expect(h.dealerUpdates).toEqual([]);
  });

  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.approveDealer(principal(), DEALER, {})).rejects.toThrow(NotFoundError);
  });

  it('audit-logs the before and after status', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(principal(), DEALER, { grantCredits: 5 });

    expect(h.audits[0]).toMatchObject({
      action: 'dealer.approved',
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'ACTIVE', creditsGranted: 5 },
    });
  });

  it('publishes DealerApproved in the same transaction', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(principal(), DEALER, {});

    expect(h.outbox[0]).toMatchObject({ eventType: 'DealerApproved' });
  });
});

describe('setDealerStatus and its wrappers', () => {
  it('suspends, stamping the time and reporting how many listings are affected', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }), counts: [7] });

    const response = await h.service.suspendDealer(principal(), DEALER, 'GST expired.');

    // D4: suspension pulls every listing out of the catalogue immediately, so the
    // admin is told how many that is before they act again.
    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'SUSPENDED',
      statusReason: 'GST expired.',
    });
    expect(h.dealerUpdates[0]?.data.suspendedAt).toBeInstanceOf(Date);
    expect(response.listingsAffected).toBe(7);
  });

  it('reinstates, clearing the suspension', async () => {
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await h.service.reinstateDealer(principal(), DEALER, 'Documents renewed.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'ACTIVE',
      statusReason: 'Documents renewed.',
      suspendedAt: null,
    });
  });

  it('keeps the original approval date on reinstatement', async () => {
    const original = new Date('2026-01-05T00:00:00.000Z');
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED', approvedAt: original }) });

    await h.service.reinstateDealer(principal(), DEALER);

    // Overwriting it would make a long-standing dealership look brand new.
    expect(h.dealerUpdates[0]?.data.approvedAt).toBe(original);
  });

  it('stamps an approval date when reinstating one that never had one', async () => {
    const h = setup({ dealer: dealerRow({ status: 'REJECTED', approvedAt: null }) });

    await h.service.reinstateDealer(principal(), DEALER);

    expect(h.dealerUpdates[0]?.data.approvedAt).toBeInstanceOf(Date);
  });

  it('accepts a reinstatement with no note', async () => {
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await h.service.reinstateDealer(principal(), DEALER);

    expect(h.dealerUpdates[0]?.data.statusReason).toBeNull();
  });

  it('rejects with the reason recorded', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.rejectDealer(principal(), DEALER, 'GSTIN does not match.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'REJECTED',
      statusReason: 'GSTIN does not match.',
    });
  });

  it('publishes the event matching the new status', async () => {
    const cases: [string, () => Promise<unknown>, string][] = [];
    const suspended = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });
    const rejected = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });
    const reinstated = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await suspended.service.suspendDealer(principal(), DEALER, 'x');
    await rejected.service.rejectDealer(principal(), DEALER, 'x');
    await reinstated.service.reinstateDealer(principal(), DEALER);

    expect(suspended.outbox[0]?.eventType).toBe('DealerSuspended');
    expect(rejected.outbox[0]?.eventType).toBe('DealerRejected');
    expect(reinstated.outbox[0]?.eventType).toBe('DealerReinstated');
    expect(cases).toEqual([]);
  });

  it('audit-logs each move with its own action name', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });

    await h.service.suspendDealer(principal(), DEALER, 'GST expired.');

    expect(h.audits[0]).toMatchObject({
      action: 'dealer.suspended',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED', reason: 'GST expired.' },
    });
  });

  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.suspendDealer(principal(), DEALER, 'x')).rejects.toThrow(NotFoundError);
  });
});

describe('reviewDocument', () => {
  it('verifies a document and records who reviewed it', async () => {
    const h = setup({ documents: [] });

    await h.service.verifyDocument(principal(), 'doc-1');

    expect(h.documentUpdates[0]?.data).toMatchObject({
      status: 'VERIFIED',
      rejectionReason: null,
      reviewedBy: 'admin-1',
    });
    expect(h.documentUpdates[0]?.data.reviewedAt).toBeInstanceOf(Date);
  });

  it('rejects a document with its reason', async () => {
    const h = setup({ documents: [] });

    await h.service.rejectDocument(principal(), 'doc-1', 'Too blurry to read.');

    expect(h.documentUpdates[0]?.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Too blurry to read.',
    });
  });

  it('reports that the dealership can be approved once all three are verified', async () => {
    const h = setup({
      documents: [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
    });

    const response = await h.service.verifyDocument(principal(), 'doc-1');

    expect(response).toEqual({
      status: 'VERIFIED',
      allVerified: true,
      dealerCanBeApproved: true,
    });
  });

  it('reports not-yet when one is still outstanding', async () => {
    const h = setup({
      documents: [{ status: 'VERIFIED' }, { status: 'UPLOADED' }, { status: 'VERIFIED' }],
    });

    expect((await h.service.verifyDocument(principal(), 'doc-1')).allVerified).toBe(false);
  });

  it('404s a document that does not exist', async () => {
    const h = setup({ document: null });

    await expect(h.service.verifyDocument(principal(), 'doc-1')).rejects.toThrow(NotFoundError);
  });

  it('audit-logs the review against the dealership', async () => {
    const h = setup({ documents: [] });

    await h.service.rejectDocument(principal(), 'doc-1', 'Blurry');

    expect(h.audits[0]).toMatchObject({
      action: 'document.rejected',
      dealerId: DEALER,
      entityType: 'DealerDocument',
    });
  });
});

describe('grantCredits', () => {
  it('grants credits as an ADMIN_GRANT', async () => {
    const h = setup();

    const response = await h.service.grantCredits(principal(), DEALER, {
      credits: 10,
      label: 'Launch offer',
    });

    expect(billing.movements[0]).toMatchObject({ delta: 10, reason: 'ADMIN_GRANT' });
    expect(response.balanceAfter).toBe(49);
    expect(response.delta).toBe(10);
  });

  it('records a deduction as an ADMIN_ADJUSTMENT', async () => {
    const h = setup();

    await h.service.grantCredits(principal(), DEALER, { credits: -5, label: 'Chargeback' });

    // The reason distinguishes a gift from a correction in the dealer's history.
    expect(billing.movements[0]).toMatchObject({ delta: -5, reason: 'ADMIN_ADJUSTMENT' });
  });

  it('uses the admin’s label verbatim in the ledger', async () => {
    const h = setup();

    await h.service.grantCredits(principal(), DEALER, {
      credits: 5,
      label: 'Goodwill — delayed review',
    });

    expect(billing.movements[0]?.label).toBe('Goodwill — delayed review');
  });

  it('audit-logs the movement and its reason', async () => {
    const h = setup();

    await h.service.grantCredits(principal(), DEALER, {
      credits: 5,
      label: 'x',
      reason: 'SUPPORT',
    });

    expect(h.audits[0]).toMatchObject({
      action: 'credits.granted',
      after: { delta: 5, reason: 'SUPPORT' },
    });
  });

  it('records a null reason when none was given', async () => {
    const h = setup();

    await h.service.grantCredits(principal(), DEALER, { credits: 5, label: 'x' });

    expect((h.audits[0]?.after as { reason: unknown }).reason).toBeNull();
  });
});

describe('queue', () => {
  it('orders oldest first and reports the wait', async () => {
    const h = setup({
      listings: [listingRow()],
      counts: [3],
      oldest: { submittedAt: new Date(Date.now() - 4 * 3_600_000) },
    });

    const response = await h.service.queue({
      limit: 24,
      status: 'PENDING_REVIEW',
    });

    expect(response.pendingCount).toBe(3);
    expect(response.oldestWaitingLabel).not.toBe('—');
    expect(response.data[0]?.submittedLabel.length).toBeGreaterThan(0);
  });

  it('renders each card with the dealer, price and photo count', async () => {
    const h = setup({ listings: [listingRow()], counts: [1] });

    const card = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0];

    expect(card).toMatchObject({
      title: '2021 Maruti Suzuki Alto 800 VXI',
      priceLabel: '₹6.45 Lakh',
      city: 'Vellore',
      kmLabel: '42,180 km',
      photoCount: 6,
    });
    expect(card?.dealer).toMatchObject({ slug: 'sri-lakshmi-motors', isVerified: true });
  });

  it('marks a listing from a non-active dealership as unverified', async () => {
    const h = setup({
      listings: [listingRow({ dealer: dealerRow({ status: 'SUSPENDED' }) })],
      counts: [1],
    });

    const card = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0];

    expect(card?.dealer.isVerified).toBe(false);
  });

  it('shows em dashes rather than zeroes for missing details', async () => {
    const h = setup({
      listings: [
        listingRow({ vehicle: vehicleRow({ pricePaise: null, kmDriven: null, city: null }) }),
      ],
      counts: [1],
    });

    const card = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0];

    expect(card?.priceLabel).toBe('—');
    expect(card?.kmLabel).toBe('—');
    expect(card?.city).toBe('—');
    expect(card?.pricePaise).toBe(0);
  });

  it('reports a null thumbnail for a listing with no photos', async () => {
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ media: [] }) })],
      counts: [1],
    });

    const card = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0];

    expect(card?.thumbnailUrl).toBeNull();
    expect(card?.photoCount).toBe(0);
  });

  it('counts only processed photos', async () => {
    const h = setup({
      listings: [
        listingRow({
          vehicle: vehicleRow({
            media: [
              { position: 0, media: { id: 'a', status: 'READY' } },
              { position: 1, media: { id: 'b', status: 'PENDING' } },
            ],
          }),
        }),
      ],
      counts: [1],
    });

    expect(
      (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.photoCount,
    ).toBe(1);
  });

  it('paginates on the submission time', async () => {
    const h = setup({
      listings: [listingRow(), listingRow({ id: 'b' }), listingRow({ id: 'c' })],
      counts: [3],
    });

    const response = await h.service.queue({
      limit: 2,
      status: 'PENDING_REVIEW',
    });

    expect(response.data).toHaveLength(2);
    expect(response.page.nextCursor).not.toBeNull();
  });
});

describe('the advisory flags', () => {
  it('warns about too few photos without blocking anything', async () => {
    const h = setup({
      listings: [
        listingRow({
          vehicle: vehicleRow({
            media: [{ position: 0, media: { id: 'a', status: 'READY' } }],
          }),
        }),
      ],
      counts: [1],
      minPhotos: 6,
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    // §10: advisory only, never auto-rejecting. A human decides.
    expect(flags?.[0]).toMatchObject({ code: 'TOO_FEW_PHOTOS', severity: 'warn' });
    expect(flags?.[0]?.message).toContain('1 photos');
  });

  it('warns about a phone number or a link in the description', async () => {
    for (const description of [
      'Call me on 98400 12345 for the best price',
      'More photos at https://example.com/car',
      '+91 9840012345',
    ]) {
      const h = setup({
        listings: [listingRow({ vehicle: vehicleRow({ description }) })],
        counts: [1],
      });

      const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

      // The whole marketplace model depends on the lead going through us.
      expect(
        flags?.some((flag) => flag.code === 'CONTACT_IN_DESCRIPTION'),
        description,
      ).toBe(true);
    }
  });

  it('does not flag an ordinary description', async () => {
    const h = setup({
      listings: [
        listingRow({
          vehicle: vehicleRow({
            description: 'Single owner, full service history, new tyres fitted in March.',
          }),
        }),
      ],
      counts: [1],
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    expect(flags?.some((flag) => flag.code === 'CONTACT_IN_DESCRIPTION')).toBe(false);
  });

  it('warns about implausible mileage per year', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ year: 2024, kmDriven: 200_000 }) })],
      counts: [1],
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    expect(flags?.some((flag) => flag.code === 'IMPLAUSIBLE_KM')).toBe(true);
  });

  it('does not flag ordinary mileage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ year: 2021, kmDriven: 42_180 }) })],
      counts: [1],
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    expect(flags?.some((flag) => flag.code === 'IMPLAUSIBLE_KM')).toBe(false);
  });

  it('never divides by zero for a car from this year', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ year: 2026, kmDriven: 5_000 }) })],
      counts: [1],
    });

    await expect(h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).resolves.toBeDefined();
  });

  it('raises no mileage flag when the odometer is unknown', async () => {
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ kmDriven: null }) })],
      counts: [1],
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    expect(flags?.some((flag) => flag.code === 'IMPLAUSIBLE_KM')).toBe(false);
  });

  it('raises no description flag when there is no description', async () => {
    const h = setup({
      listings: [listingRow({ vehicle: vehicleRow({ description: null }) })],
      counts: [1],
    });

    const flags = (await h.service.queue({ limit: 24, status: 'PENDING_REVIEW' })).data[0]?.flags;

    expect(flags?.some((flag) => flag.code === 'CONTACT_IN_DESCRIPTION')).toBe(false);
  });
});

describe('listingDetail', () => {
  it('404s a listing that does not exist', async () => {
    const h = setup({ listing: null });

    await expect(h.service.listingDetail(LISTING)).rejects.toThrow(NotFoundError);
  });

  it('gathers everything a moderator needs on one screen', async () => {
    const h = setup();

    const detail = await h.service.listingDetail(LISTING);

    expect(detail.title).toBe('2021 Maruti Suzuki Alto 800 VXI');
    expect(detail.photoCount).toBe(6);
    expect(detail.photoCountLabel).toBe('6 submitted photos');
    expect(detail.specs.map((spec) => spec.key)).toEqual([
      'km',
      'fuel',
      'transmission',
      'owners',
      'bodyType',
      'photos',
      'dealerStatus',
    ]);
  });

  it('pluralises a single photo', async () => {
    const h = setup({
      listing: listingRow({
        vehicle: vehicleRow({ media: [{ position: 0, media: { id: 'a', status: 'READY' } }] }),
      }),
    });

    expect((await h.service.listingDetail(LISTING)).photoCountLabel).toBe('1 submitted photo');
  });

  it('notes whether the dealership has a GSTIN on file', async () => {
    const withGstin = setup();
    const without = setup({ listing: listingRow({ dealer: dealerRow({ gstin: null }) }) });
    const suspended = setup({
      listing: listingRow({ dealer: dealerRow({ status: 'SUSPENDED' }) }),
    });

    const value = (detail: Awaited<ReturnType<typeof withGstin.service.listingDetail>>) =>
      detail.specs.find((spec) => spec.key === 'dealerStatus')?.value;

    expect(value(await withGstin.service.listingDetail(LISTING))).toBe('Verified · GSTIN on file');
    expect(value(await without.service.listingDetail(LISTING))).toBe('Verified');
    expect(value(await suspended.service.listingDetail(LISTING))).not.toContain('Verified');
  });

  it('offers the review actions only while the listing is in review', async () => {
    const pending = setup();
    const approved = setup({ listing: listingRow({ status: 'APPROVED' }) });

    const pendingActions = (await pending.service.listingDetail(LISTING)).actions;
    const approvedActions = (await approved.service.listingDetail(LISTING)).actions;

    expect(pendingActions).toMatchObject({
      canApprove: true,
      canReject: true,
      canRequestChanges: true,
      canTakedown: true,
    });
    expect(approvedActions).toMatchObject({
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
      canTakedown: true,
    });
  });

  it('spells out the consequence of approving, with the listing duration', async () => {
    const h = setup();

    const note = (await h.service.listingDetail(LISTING)).actions.consequenceNote;

    // An irreversible action that spends a dealer's money says so before it is
    // taken.
    expect(note).toContain('90 days');
    expect(note).toContain("spends one of the dealer's credits");
    expect(note).toContain('cannot be undone');
  });

  it('reports the held credit so the moderator can see what is at stake', async () => {
    const h = setup();

    expect((await h.service.listingDetail(LISTING)).credit).toEqual({
      held: true,
      transactionId: 'txn-original',
      dealerBalance: 39,
    });
  });

  it('offers the configured rejection presets', async () => {
    const h = setup({ presets: ['Photos are too few.', 'Price is implausible.'] });

    expect((await h.service.listingDetail(LISTING)).rejectionReasonPresets).toEqual([
      'Photos are too few.',
      'Price is implausible.',
    ]);
  });

  it('labels each photo from its file name, or numbers it', async () => {
    const h = setup({
      listing: listingRow({
        vehicle: vehicleRow({
          media: [
            { position: 0, media: { id: 'a', status: 'READY', fileName: 'front-left.jpg' } },
            { position: 1, media: { id: 'b', status: 'READY', fileName: null } },
          ],
        }),
      }),
    });

    const photos = (await h.service.listingDetail(LISTING)).photos;

    expect(photos[0]?.label).toBe('front left');
    expect(photos[1]?.label).toBe('Photo 2');
  });
});

describe('approveListing', () => {
  it('settles the hold with a delta-zero ledger row', async () => {
    const h = setup();

    await h.service.approveListing(principal(), LISTING);

    // §26.3: still a row, because the dealer needs to see "Listing published —"
    // in their history on the day it happened, at the balance it happened at.
    expect(billing.movements[0]).toMatchObject({
      delta: 0,
      reason: 'CONSUME_APPROVE',
      listingId: LISTING,
    });
    expect(String(billing.movements[0]?.label)).toContain('Listing published —');
  });

  it('publishes the listing with an expiry and clears the hold flag', async () => {
    const h = setup();

    const response = await h.service.approveListing(principal(), LISTING);

    expect(h.listingUpdates[0]?.data).toMatchObject({
      status: 'APPROVED',
      creditHeld: false,
      rejectionReason: null,
      changeRequestNote: null,
      reviewedBy: 'admin-1',
    });
    expect(new Date(response.expiresAt).getTime() - new Date(response.approvedAt).getTime()).toBe(
      90 * 86_400_000,
    );
  });

  it('reports one credit consumed and the public URL', async () => {
    const h = setup();

    const response = await h.service.approveListing(principal(), LISTING);

    expect(response.credit.consumed).toBe(1);
    expect(response.publicUrl).toBe(`${env.WEB_BASE_URL}/car/2021-alto-800-vellore-abc123`);
    expect(response.displayStatus).toBe('ACTIVE');
  });

  it('survives a vehicle with no slug rather than linking to undefined', async () => {
    const h = setup({ listing: listingRow({ vehicle: vehicleRow({ slug: null }) }) });

    expect((await h.service.approveListing(principal(), LISTING)).publicUrl).toBe(
      `${env.WEB_BASE_URL}/car/`,
    );
  });

  it('recomputes both dealer counters', async () => {
    const h = setup();

    await h.service.approveListing(principal(), LISTING);

    expect(billing.heldRefreshes).toBe(1);
    expect(billing.activeRefreshes).toBe(1);
  });

  it('refuses to approve a listing that is not in review', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    // D9: two moderators opening the same card is expected; the second gets a
    // clear error rather than a double approval.
    await expect(h.service.approveListing(principal(), LISTING)).rejects.toThrow(ConflictError);
    expect([h.listingUpdates, billing.movements]).toEqual([[], []]);
  });

  it('404s a listing that does not exist', async () => {
    const h = setup({ listing: null });

    await expect(h.service.approveListing(principal(), LISTING)).rejects.toThrow(NotFoundError);
  });

  it('publishes ListingApproved asynchronously rather than indexing inline', async () => {
    const h = setup();

    await h.service.approveListing(principal(), LISTING);

    // §10: indexing, revalidation and the dealer email are all asynchronous, and
    // none of them can roll back the approval.
    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingApproved' });
  });

  it('audit-logs the approval with its expiry', async () => {
    const h = setup();

    await h.service.approveListing(principal(), LISTING);

    expect(h.audits[0]).toMatchObject({
      action: 'listing.approved',
      before: { status: 'PENDING_REVIEW' },
    });
    expect((h.audits[0]?.after as { expiresAt: string }).expiresAt).toMatch(/^\d{4}-/);
  });
});

describe('rejectListing', () => {
  it('returns the held credit', async () => {
    const h = setup();

    const response = await h.service.rejectListing(principal(), LISTING, 'Photos are too few.');

    expect(billing.movements[0]).toMatchObject({ delta: 1, reason: 'RELEASE_REJECT' });
    expect(response.credit.released).toBe(1);
    expect(response.credit.dealerBalanceAfter).toBe(40);
  });

  it('returns nothing when the listing was not holding a credit', async () => {
    const h = setup({ listing: listingRow({ creditHeld: false }) });

    const response = await h.service.rejectListing(principal(), LISTING, 'Photos are too few.');

    expect(billing.movements).toEqual([]);
    expect(response.credit).toMatchObject({ released: 0, transactionId: null });
  });

  it('stores the reason verbatim', async () => {
    const h = setup();

    const reason = 'Odometer photo does not match the declared KM reading.';
    const response = await h.service.rejectListing(principal(), LISTING, reason);

    // The dealer reads this exact string in their inventory banner.
    expect(h.listingUpdates[0]?.data).toMatchObject({ rejectionReason: reason, creditHeld: false });
    expect(response.reason).toBe(reason);
  });

  it('refuses to reject a listing that is not in review', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    await expect(h.service.rejectListing(principal(), LISTING, 'x')).rejects.toThrow(ConflictError);
  });

  it('404s a listing that does not exist', async () => {
    const h = setup({ listing: null });

    await expect(h.service.rejectListing(principal(), LISTING, 'x')).rejects.toThrow(NotFoundError);
  });

  it('refreshes the held count and publishes ListingRejected', async () => {
    const h = setup();

    await h.service.rejectListing(principal(), LISTING, 'x');

    expect(billing.heldRefreshes).toBe(1);
    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingRejected' });
  });
});

describe('requestChanges', () => {
  it('writes no ledger row at all — the hold survives', async () => {
    const h = setup();

    const response = await h.service.requestChanges(principal(), LISTING, 'Add an interior photo.');

    // D11, and the entire difference from a rejection: the surviving hold is what
    // lets the dealer resubmit without paying twice.
    expect(billing.movements).toEqual([]);
    expect(response.credit).toEqual({ stillHeld: 1, dealerBalanceAfter: 39 });
  });

  it('leaves creditHeld untouched on the row', async () => {
    const h = setup();

    await h.service.requestChanges(principal(), LISTING, 'Add an interior photo.');

    expect(h.listingUpdates[0]?.data).not.toHaveProperty('creditHeld');
  });

  it('stores the note and records who asked', async () => {
    const h = setup();

    await h.service.requestChanges(principal(), LISTING, 'Add an interior photo.');

    expect(h.listingUpdates[0]?.data).toMatchObject({
      status: 'CHANGES_REQUESTED',
      changeRequestNote: 'Add an interior photo.',
      reviewedBy: 'admin-1',
    });
  });

  it('refuses on a listing that is not in review', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    await expect(h.service.requestChanges(principal(), LISTING, 'x')).rejects.toThrow(
      ConflictError,
    );
  });

  it('404s a listing that does not exist', async () => {
    const h = setup({ listing: null });

    await expect(h.service.requestChanges(principal(), LISTING, 'x')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('publishes ListingChangesRequested', async () => {
    const h = setup();

    await h.service.requestChanges(principal(), LISTING, 'x');

    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingChangesRequested' });
  });
});

describe('takedown', () => {
  it('removes the listing and records the reason', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    const response = await h.service.takedown(principal(), LISTING, {
      reason: 'Sold elsewhere',
      refundCredit: false,
    });

    expect(h.listingUpdates[0]?.data).toMatchObject({
      status: 'REMOVED',
      rejectionReason: 'Sold elsewhere',
      creditHeld: false,
    });
    expect(response.status).toBe('REMOVED');
    expect(response.creditRefunded).toBe(false);
  });

  it('refunds a credit as a REVERSAL when asked', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    const response = await h.service.takedown(principal(), LISTING, {
      reason: 'Our mistake',
      refundCredit: true,
    });

    expect(billing.movements[0]).toMatchObject({ delta: 1, reason: 'REVERSAL' });
    expect(response.creditRefunded).toBe(true);
  });

  it('refunds nothing by default', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    await h.service.takedown(principal(), LISTING, { reason: 'x', refundCredit: false });

    expect(billing.movements).toEqual([]);
  });

  it('recomputes both counters, so the catalogue empties', async () => {
    const h = setup({ listing: listingRow({ status: 'APPROVED' }) });

    await h.service.takedown(principal(), LISTING, { reason: 'x', refundCredit: false });

    expect(billing.heldRefreshes).toBe(1);
    expect(billing.activeRefreshes).toBe(1);
    expect(h.outbox[0]).toMatchObject({ eventType: 'ListingRemoved' });
  });

  it('refuses to take down a listing in a state the table forbids', async () => {
    const h = setup({ listing: listingRow({ status: 'SOLD' }) });

    await expect(
      h.service.takedown(principal(), LISTING, { reason: 'x', refundCredit: false }),
    ).rejects.toThrow(ConflictError);
  });

  it('404s a listing that does not exist', async () => {
    const h = setup({ listing: null });

    await expect(
      h.service.takedown(principal(), LISTING, { reason: 'x', refundCredit: false }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('payments', () => {
  const payment = (overrides: Record<string, unknown> = {}) => ({
    id: 'payment-1',
    gatewayPaymentId: 'dev_pay_1',
    amountPaise: 531_000n,
    method: 'development',
    status: 'CAPTURED',
    capturedAt: new Date('2026-08-17T10:00:00.000Z'),
    createdAt: new Date('2026-08-17T09:59:00.000Z'),
    dealer: { slug: 'sri-lakshmi-motors', brandName: 'Sri Lakshmi Motors' },
    order: { credits: 10 },
    invoices: [{ number: 'DD-INV-2026-0007' }],
    ...overrides,
  });

  it('lists captured payments with their invoice numbers', async () => {
    const h = setup({ payments: [payment()], capturedSum: 531_000n, capturedCount: 1 });

    const response = await h.service.payments(principal(), { limit: 24 });

    expect(response.data[0]).toMatchObject({
      gatewayPaymentId: 'dev_pay_1',
      invoiceNumber: 'DD-INV-2026-0007',
      credits: 10,
      amountPaise: 531_000,
      amountLabel: '₹5,310',
      statusTone: 'ok',
    });
  });

  it('tones a failed payment as an error and a pending one as neutral', async () => {
    const failed = setup({ payments: [payment({ status: 'FAILED', capturedAt: null })] });
    const pending = setup({ payments: [payment({ status: 'PENDING', capturedAt: null })] });

    expect((await failed.service.payments(principal(), { limit: 24 })).data[0]?.statusTone).toBe(
      'err',
    );
    expect((await pending.service.payments(principal(), { limit: 24 })).data[0]?.statusTone).toBe(
      'neutral',
    );
  });

  it('dates an uncaptured payment by when it was created', async () => {
    const h = setup({ payments: [payment({ capturedAt: null })] });

    const row = (await h.service.payments(principal(), { limit: 24 })).data[0];

    expect(row?.capturedAt).toBeNull();
    expect(row?.dateLabel).toBe('17 Aug 2026');
  });

  it('reports a null invoice number when none was issued', async () => {
    const h = setup({ payments: [payment({ invoices: [] })] });

    expect(
      (await h.service.payments(principal(), { limit: 24 })).data[0]?.invoiceNumber,
    ).toBeNull();
  });

  it('totals gross, net and tax over the period', async () => {
    const h = setup({ capturedSum: 11_800_000n, capturedCount: 4, gstPercent: 18 });

    const totals = (await h.service.payments(principal(), { limit: 24 })).totals;

    expect(totals).toMatchObject({
      grossPaise: 11_800_000,
      netPaise: 10_000_000,
      taxPaise: 1_800_000,
      count: 4,
    });
  });

  it('defaults the period to the last 30 days', async () => {
    const h = setup();

    expect((await h.service.payments(principal(), { limit: 24 })).totals.periodLabel).toBe(
      'Last 30 days',
    );
  });

  it('labels an explicit range, and says "today" for an open end', async () => {
    const h = setup();

    const closed = await h.service.payments(principal(), {
      limit: 24,
      from: '2026-08-01',
      to: '2026-08-17',
    });
    const open = await h.service.payments(principal(), {
      limit: 24,
      from: '2026-08-01',
    });

    expect(closed.totals.periodLabel).toBe('2026-08-01 to 2026-08-17');
    expect(open.totals.periodLabel).toBe('2026-08-01 to today');
  });

  it('reports zeroes for a period with no captures', async () => {
    const h = setup({ capturedSum: null });

    const totals = (await h.service.payments(principal(), { limit: 24 })).totals;

    expect(totals).toMatchObject({ grossPaise: 0, netPaise: 0, taxPaise: 0 });
  });
});

describe('config', () => {
  it('lists every key with its type and label', async () => {
    const h = setup({
      configEntries: [
        { key: 'listing.minPhotos', label: 'Minimum photos', type: 'number', value: 6 },
      ],
    });

    expect((await h.service.config()).data[0]).toEqual({
      key: 'listing.minPhotos',
      label: 'Minimum photos',
      type: 'number',
      value: 6,
      updatedAt: null,
    });
  });
});

describe('setConfig', () => {
  it('writes the value and reports what it replaced', async () => {
    const h = setup();

    const response = await h.service.setConfig(principal(), 'listing.minPhotos', 8);

    expect(h.configWrites[0]).toEqual({ key: 'listing.minPhotos', value: 8, by: 'admin-1' });
    expect(response).toMatchObject({
      key: 'listing.minPhotos',
      value: 8,
      previousValue: 6,
      updatedBy: 'admin-1',
    });
  });

  it('audit-logs the change with both values', async () => {
    const h = setup();

    await h.service.setConfig(principal(), 'listing.minPhotos', 8);

    // Changing the photo minimum changes what every dealer can publish; the log
    // is how anyone finds out who did it.
    expect(h.detachedAudits[0]).toMatchObject({
      action: 'config.updated',
      entityType: 'PlatformConfig',
      entityId: 'listing.minPhotos',
      before: { value: 6 },
      after: { value: 8 },
    });
  });

  it('404s an unknown key without writing', async () => {
    const h = setup();

    await expect(h.service.setConfig(principal(), 'listing.nonsense', 1)).rejects.toThrow(
      NotFoundError,
    );
    expect(h.configWrites).toEqual([]);
  });
});

describe('auditLogs', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: 42n,
    actorType: 'ADMIN',
    actorId: 'admin-1',
    action: 'listing.approved',
    entityType: 'Listing',
    entityId: LISTING,
    dealerId: DEALER,
    before: { status: 'PENDING_REVIEW' },
    after: { status: 'APPROVED' },
    ip: '203.0.113.9',
    traceId: 'trace-1',
    createdAt: new Date('2026-08-17T10:00:00.000Z'),
    ...overrides,
  });

  it('resolves each actor to their email', async () => {
    const h = setup({
      auditRows: [entry()],
      users: [{ id: 'admin-1', email: 'ops@dealers-drive.in' }],
    });

    const response = await h.service.auditLogs(principal(), { limit: 24 });

    expect(response.data[0]?.actor).toEqual({ id: 'admin-1', email: 'ops@dealers-drive.in' });
  });

  it('reports a null email for an actor who has been deleted', async () => {
    const h = setup({ auditRows: [entry()], users: [] });

    expect((await h.service.auditLogs(principal(), { limit: 24 })).data[0]?.actor.email).toBeNull();
  });

  it('reports a null actor for a system action', async () => {
    const h = setup({ auditRows: [entry({ actorType: 'SYSTEM', actorId: null })] });

    const actor = (await h.service.auditLogs(principal(), { limit: 24 })).data[0]?.actor;

    expect(actor).toEqual({ id: null, email: null });
  });

  it('serialises the BIGSERIAL id as a string', async () => {
    const h = setup({ auditRows: [entry({ id: 9_007_199_254_740_993n })] });

    // The audit log outgrows Number long before anything else does.
    expect((await h.service.auditLogs(principal(), { limit: 24 })).data[0]?.id).toBe(
      '9007199254740993',
    );
  });

  it('carries the before and after states through', async () => {
    const h = setup({ auditRows: [entry()] });

    const row = (await h.service.auditLogs(principal(), { limit: 24 })).data[0];

    expect(row?.before).toEqual({ status: 'PENDING_REVIEW' });
    expect(row?.after).toEqual({ status: 'APPROVED' });
    expect(row?.traceId).toBe('trace-1');
  });

  it('paginates newest first', async () => {
    const h = setup({ auditRows: [entry(), entry({ id: 41n }), entry({ id: 40n })] });

    const response = await h.service.auditLogs(principal(), { limit: 2 });

    expect(response.data).toHaveLength(2);
    expect(response.page.hasMore).toBe(true);
  });

  it('looks up no users when the page has none to resolve', async () => {
    const h = setup({ auditRows: [] });

    expect((await h.service.auditLogs(principal(), { limit: 24 })).data).toEqual([]);
  });
});
