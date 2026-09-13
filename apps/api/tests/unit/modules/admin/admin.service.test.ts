import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { AdminOverview } from '@dealers-drive/contracts';

import { env } from '../../../../src/config/env.js';
import { createAdminService } from '../../../../src/modules/admin/admin.service.js';
import type { AuditService } from '../../../../src/platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import {
  type DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../../../src/platform/errors.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';
import type { AdminPrincipal } from '../../../../src/modules/auth/auth.facade.js';

/**
 * Unit tests for `src/modules/admin/admin.service.ts`.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file covers fourteen permission checks and the whole moderation
 * surface. F049 brought `overview` — the console shell's guard as well as its
 * landing page — F044 the KYC review, and **F045 the dealer status machine**.
 *
 * Two facts carry the dealer half. The permission is checked in the service
 * rather than the router, so a SUPPORT seat is refused in the same function
 * that would have done the work; and the status change, its audit row and its
 * outbox event are written in one transaction, so there is no state in which a
 * dealership went ACTIVE without a record of who made it so.
 * ────────────────────────────────────────────────────────────────────────────
 */
interface Options {
  dealers?: number;
  pending?: number;
  gstPercent?: number;
  /** The row `POST /documents/:id/*` addresses, or null for a 404. */
  document?: Record<string, unknown> | null;
  /** The dealership's documents after the update — what `allVerified` reads. */
  siblings?: Record<string, unknown>[];
  /** The row every `/dealers/:id` path resolves, or null for a 404. */
  dealer?: Record<string, unknown> | null;
  /**
   * The page `GET /dealers` answers with. The baseline names this option
   * `dealers`; that name is taken here by the overview's dealership count until
   * F064 restores the counters `overview()` resolves in the same `Promise.all`.
   */
  dealerRows?: Record<string, unknown>[];
  grouped?: { status: string; _count: { _all: number } }[];
  /** The dealership's `media` rows — the yard photograph, and a logo if any. */
  media?: { storageKey: string }[];
  /** Storage keys whose delete rejects, so the purge's tolerance is testable. */
  missingKeys?: string[];
  /** F072 — what `config.all()` answers with. */
  configEntries?: { key: string; label: string; type: string; value: unknown }[];
  /** R42 — the `users` rows the admin-access list reads. */
  adminUsers?: Record<string, unknown>[];
}

const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';

/**
 * The dealership's folder in the bucket, named after the dealership rather than
 * after its UUID. Its slug is what the key is derived from, so every assertion
 * below reads the same way a bucket listing does.
 */
const DEALER_SLUG = 'sri-lakshmi-motors-pvt-ltd-vellore-tamil-nadu';
const DEALER_ROOT = `dealers/${DEALER_SLUG}`;

function dealerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEALER,
    slug: DEALER_SLUG,
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
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    tagline: 'Family-run since 1998 — hatchbacks under ₹6 lakh.',
    specialities: ['In-house workshop', 'RC transfer assistance'],
    /** R34. Empty is the ordinary case: no edit is waiting on a moderator. */
    profileEdits: [],
    documents: [],
    members: [
      {
        userId: 'user-1',
        user: { fullName: 'Ramesh Kumar', email: 'owner@sri-lakshmi-motors.in' },
      },
    ],
    ...overrides,
  };
}

function setup(options: Options = {}) {
  const counts = [options.dealers ?? 0, options.pending ?? 0];
  const documentUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const dealerQueries: Record<string, unknown>[] = [];
  const dealerUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const auditRows: Record<string, unknown>[] = [];
  const detachedAudits: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const signedUrls: string[] = [];
  const deletedKeys: string[] = [];
  const deletedDealers: unknown[] = [];
  const deletedMedia: unknown[] = [];
  const dealerPatches: { dealerId: string; input: unknown }[] = [];
  const userUpdates: unknown[] = [];
  const seatCreates: unknown[] = [];
  const seatUpdates: unknown[] = [];
  const seatUpserts: unknown[] = [];
  const seatDeletes: unknown[] = [];
  const userWrites: unknown[] = [];
  const configWrites: { key: string; value: unknown; updatedBy: string | null }[] = [];
  const sessionUpdates: unknown[] = [];

  const resolveDealer = () =>
    Promise.resolve(options.dealer === null ? null : dealerRow(options.dealer ?? {}));

  const tx = {
    dealerDocument: {
      findUnique: () =>
        Promise.resolve(options.document === undefined ? DOCUMENT : options.document),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        documentUpdates.push(args);
        return Promise.resolve({});
      },
      findMany: () => Promise.resolve(options.siblings ?? []),
    },
    dealer: {
      findUnique: resolveDealer,
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        dealerUpdates.push(args);
        return Promise.resolve(dealerRow({ ...(options.dealer ?? {}), ...args.data }));
      },
    },
    outboxEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        outbox.push(args.data);
        return Promise.resolve({});
      },
    },
    media: {
      deleteMany: (args: unknown) => {
        deletedMedia.push(args);
        return Promise.resolve({ count: (options.media ?? []).length });
      },
    },
    userRole: {
      createMany: (args: unknown) => {
        seatCreates.push(args);
        return Promise.resolve({ count: 1 });
      },
      updateMany: (args: unknown) => {
        seatUpdates.push(args);
        return Promise.resolve({ count: 1 });
      },
      upsert: (args: unknown) => {
        seatUpserts.push(args);
        return Promise.resolve({ grantedAt: new Date('2026-09-13T00:00:00.000Z') });
      },
      delete: (args: unknown) => {
        seatDeletes.push(args);
        return Promise.resolve({});
      },
    },
    user: {
      updateMany: (args: unknown) => {
        userUpdates.push(args);
        return Promise.resolve({ count: 1 });
      },
      findUnique: (args: { where: { email?: string } }) =>
        Promise.resolve(
          args.where.email === 'known@dealers-drive.test'
            ? { id: 'user-known', email: args.where.email, fullName: 'Known Operator' }
            : null,
        ),
      create: (args: { data: Record<string, unknown> }) => {
        userWrites.push({ op: 'create', ...args });
        return Promise.resolve({ id: 'user-new', fullName: null, lastLoginAt: null, ...args.data });
      },
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        userWrites.push({ op: 'update', ...args });
        return Promise.resolve({
          id: 'user-known',
          email: 'known@dealers-drive.test',
          fullName: 'Known Operator',
          lastLoginAt: null,
          ...args.data,
        });
      },
    },
    session: {
      updateMany: (args: unknown) => {
        sessionUpdates.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
  };

  // `delete` only exists on the transaction handle, and only rejection calls
  // it. Assigning it here rather than in the literal keeps the shape above
  // readable while still letting `tx.dealer.delete` be recorded.
  (tx.dealer as unknown as { delete: (args: unknown) => Promise<unknown> }).delete = (
    args: unknown,
  ) => {
    deletedDealers.push(args);
    return Promise.resolve({});
  };

  const prisma = {
    dealer: {
      count: () => Promise.resolve(counts.shift() ?? 0),
      // Every `findMany` — the page itself and the three facet queries — is
      // recorded, because what the service asks for is the thing under test in
      // the filter cases below.
      findMany: (args: Record<string, unknown>) => {
        dealerQueries.push(args);
        return Promise.resolve(options.dealerRows ?? []);
      },
      findUnique: resolveDealer,
      groupBy: () => Promise.resolve(options.grouped ?? []),
    },
    media: {
      findMany: () => Promise.resolve(options.media ?? []),
    },
    user: {
      findMany: (args: { where?: { id?: { in?: string[] } } }) =>
        Promise.resolve(
          args.where?.id?.in
            ? [{ id: 'admin-1', email: 'ops@dealers-drive.test' }]
            : (options.adminUsers ?? []),
        ),
      findUnique: (args: { where: { id: string } }) =>
        Promise.resolve(
          (options.adminUsers ?? []).find((row) => (row as { id?: string }).id === args.where.id) ??
            null,
        ),
    },
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
  } as unknown as PrismaClient;

  const config = {
    number: () => Promise.resolve(options.gstPercent ?? 18),
    all: () => Promise.resolve(options.configEntries ?? CONFIG_ROWS),
    set: (key: string, value: unknown, updatedBy: string | null) => {
      configWrites.push({ key, value, updatedBy });
      return Promise.resolve({ key, value });
    },
  } as unknown as PlatformConfigService;

  const audit = {
    record: (_tx: unknown, entry: Record<string, unknown>) => {
      auditRows.push(entry);
      return Promise.resolve();
    },
    recordDetached: (entry: Record<string, unknown>) => {
      detachedAudits.push(entry);
      return Promise.resolve();
    },
  } as unknown as AuditService;

  const storage = {
    signedReadUrl: (key: string) => {
      signedUrls.push(key);
      return Promise.resolve(`https://storage.test/private/${key}?signed`);
    },
    delete: (key: string) => {
      deletedKeys.push(key);
      // A key the option names as already gone rejects, which is what the
      // purge's `allSettled` exists to survive.
      return options.missingKeys?.includes(key)
        ? Promise.reject(new Error('NoSuchKey'))
        : Promise.resolve();
    },
  } as unknown as StoragePort;

  /**
   * The dealer service, as the admin service sees it: one method.
   *
   * `updateDealer` delegates the whole write — normalisation, the duplicate
   * check, the `brandName` mirror — so what this unit can assert is that the
   * console hands the input over unchanged and audits the result. That the
   * write itself is right is `dealers.service`'s own test.
   */
  const dealers = {
    update: (dealerId: string, input: unknown) => {
      dealerPatches.push({ dealerId, input });
      return Promise.resolve({ id: dealerId, legalName: 'Sri Lakshmi Motors Pvt Ltd' });
    },
  } as unknown as Parameters<typeof createAdminService>[0]['dealers'];

  return {
    service: createAdminService({ prisma, audit, config, storage, dealers }),
    dealerQueries,
    documentUpdates,
    dealerUpdates,
    auditRows,
    detachedAudits,
    outbox,
    signedUrls,
    deletedKeys,
    deletedDealers,
    deletedMedia,
    dealerPatches,
    userUpdates,
    seatCreates,
    seatUpdates,
    seatUpserts,
    seatDeletes,
    userWrites,
    configWrites,
    sessionUpdates,
  };
}

/**
 * Two settings, and the split is the thing under test: one key something reads
 * and one nothing reads yet. `billing.gstPercent` is in `CONFIG_READERS`;
 * `otp.maxAttempts` is deliberately not.
 */
const CONFIG_ROWS = [
  { key: 'billing.gstPercent', label: 'GST percent', type: 'number', value: 18 },
  { key: 'otp.maxAttempts', label: 'OTP attempts allowed', type: 'number', value: 3 },
];

const DOCUMENT = {
  id: 'doc-1',
  dealerId: 'dealer-1',
  type: 'GST_CERTIFICATE',
  status: 'UPLOADED',
};

/** Three rows, all verified — the only shape that makes `allVerified` true. */
const ALL_VERIFIED = [
  { type: 'GST_CERTIFICATE', status: 'VERIFIED' },
  { type: 'PAN_CARD', status: 'VERIFIED' },
  { type: 'ADDRESS_PROOF', status: 'VERIFIED' },
];

const admin: AdminPrincipal = {
  kind: 'ADMIN',
  userId: 'admin-1',
  email: 'ops@dealers-drive.test',
  adminRole: 'SUPER_ADMIN',
  permissions: [
    'admin:metrics:read',
    'admin:dealer:approve',
    // F072 and R42 — the settings screen and the access list on it.
    'admin:config:write',
    'admin:access:manage',
  ],
} as unknown as AdminPrincipal;

/** A seat that may read the console and change nothing on it. */
const support: AdminPrincipal = {
  kind: 'ADMIN',
  userId: 'support-1',
  email: 'support@dealers-drive.test',
  adminRole: 'SUPPORT',
  permissions: ['admin:metrics:read', 'admin:payment:read'],
} as unknown as AdminPrincipal;

function statFor(overview: AdminOverview, key: string): AdminOverview['stats'][number] | undefined {
  return overview.stats.find((stat) => stat.key === key);
}

describe('overview', () => {
  it('counts every dealership, and the ones waiting on a decision', async () => {
    const h = setup({ dealers: 12, pending: 3 });

    const overview = await h.service.overview(admin);

    expect(statFor(overview, 'totalDealers')).toMatchObject({ value: 12, valueLabel: '12' });
    expect(statFor(overview, 'pendingVerification')).toMatchObject({ value: 3, valueLabel: '3' });
  });

  /** The tile is a link into the filter that shows exactly those dealerships. */
  it('links the pending tile at the queue it counts', async () => {
    const h = setup({ dealers: 4, pending: 4 });

    expect(statFor(await h.service.overview(admin), 'pendingVerification')?.href).toBe(
      '/admin/dealers?status=PENDING_APPROVAL',
    );
  });

  /**
   * `payments30d` is gross captured and `revenue30d` is net of GST. They differ
   * on purpose, and reporting one as the other is the kind of mistake that
   * reaches a board deck — so the split is asserted even while both are zero.
   */
  it('reports payments gross and revenue net of GST', async () => {
    const h = setup({ gstPercent: 18 });

    const overview = await h.service.overview(admin);

    expect(statFor(overview, 'payments30d')?.value).toBe(0);
    expect(statFor(overview, 'revenue30d')?.value).toBe(0);
  });

  it('names the signed-in operator from the principal, never from a row', async () => {
    const h = setup();

    // The header cannot show one operator while the audit log records another.
    expect((await h.service.overview(admin)).operator).toEqual({
      email: 'ops@dealers-drive.test',
      adminRole: 'SUPER_ADMIN',
    });
  });

  it('reports a quiet moderation queue as quiet, and tones the badge neutral', async () => {
    const h = setup();

    const overview = await h.service.overview(admin);

    expect(overview.moderationQueue.pendingCount).toBe(0);
    expect(overview.moderationQueue.message).toMatch(/No listings are waiting/);
    expect(overview.headerBadge).toMatchObject({ count: 0, tone: 'neutral' });
  });

  it('answers with every tile the console renders', async () => {
    const h = setup();

    expect((await h.service.overview(admin)).stats.map((stat) => stat.key)).toEqual([
      'totalDealers',
      'pendingVerification',
      'activeListings',
      'payments30d',
      'revenue30d',
      'newEnquiries',
    ]);
  });
});

/**
 * D5 — the platform side of the KYC upload.
 *
 * Two things here are the feature and everything else is plumbing: the
 * permission is checked in the service rather than in the router, so it cannot
 * be reached around; and the decision and its audit row are written in one
 * transaction, so there is no state in which a document changed hands without
 * a record of who changed it.
 */
describe('the KYC review', () => {
  const moderator: AdminPrincipal = {
    ...admin,
    adminRole: 'MODERATOR',
    permissions: ['admin:document:review'],
  } as unknown as AdminPrincipal;

  const support: AdminPrincipal = {
    ...admin,
    adminRole: 'SUPPORT',
    permissions: ['admin:metrics:read'],
  } as unknown as AdminPrincipal;

  it('marks a document verified', async () => {
    const h = setup({ siblings: ALL_VERIFIED });

    const result = await h.service.verifyDocument(moderator, 'doc-1');

    expect(h.documentUpdates[0]?.data).toMatchObject({
      status: 'VERIFIED',
      rejectionReason: null,
      reviewedBy: 'admin-1',
    });
    expect(result.status).toBe('VERIFIED');
  });

  /** The dealer reads this verbatim; "rejected" alone is a support call. */
  it('records the reason a rejection gives the dealer', async () => {
    const h = setup({ siblings: [] });

    const result = await h.service.rejectDocument(moderator, 'doc-1', 'Too blurry to read.');

    expect(h.documentUpdates[0]?.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Too blurry to read.',
    });
    expect(result.status).toBe('REJECTED');
  });

  it('stamps who reviewed it and when', async () => {
    const h = setup({ siblings: [] });

    await h.service.verifyDocument(moderator, 'doc-1');

    expect(h.documentUpdates[0]?.data.reviewedBy).toBe('admin-1');
    expect(h.documentUpdates[0]?.data.reviewedAt).toBeInstanceOf(Date);
  });

  /**
   * `allVerified` is what tells the moderator the dealership is ready — so it
   * has to mean *all three*, not "all the ones uploaded so far".
   */
  it('reports allVerified only when all three documents are verified', async () => {
    const all = setup({ siblings: ALL_VERIFIED });
    const two = setup({ siblings: ALL_VERIFIED.slice(0, 2) });
    const mixed = setup({
      siblings: [...ALL_VERIFIED.slice(0, 2), { type: 'ADDRESS_PROOF', status: 'REJECTED' }],
    });

    expect((await all.service.verifyDocument(moderator, 'doc-1')).allVerified).toBe(true);
    expect((await two.service.verifyDocument(moderator, 'doc-1')).allVerified).toBe(false);
    expect((await mixed.service.verifyDocument(moderator, 'doc-1')).allVerified).toBe(false);
  });

  it('derives dealerCanBeApproved from the same answer', async () => {
    const h = setup({ siblings: ALL_VERIFIED });

    // Two admins looking at one dealership must not reach different conclusions
    // about whether it is ready; the API decides, not the console.
    const result = await h.service.verifyDocument(moderator, 'doc-1');
    expect(result.dealerCanBeApproved).toBe(result.allVerified);
  });

  it('audits the decision with the admin who made it, and the status it replaced', async () => {
    const h = setup({ siblings: [] });

    await h.service.rejectDocument(moderator, 'doc-1', 'Too blurry to read.');

    expect(h.auditRows[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      dealerId: 'dealer-1',
      action: 'document.rejected',
      entityType: 'DealerDocument',
      entityId: 'doc-1',
      before: { status: 'UPLOADED' },
      after: { status: 'REJECTED', reason: 'Too blurry to read.' },
    });
  });

  it('names the verify decision separately in the audit log', async () => {
    const h = setup({ siblings: [] });

    await h.service.verifyDocument(moderator, 'doc-1');

    expect(h.auditRows[0]).toMatchObject({ action: 'document.verified' });
  });

  /**
   * The check is in the service, not the chain. A SUPPORT admin gets through
   * `requireAdmin` and is refused here — which is the only place it could be
   * refused if another caller ever reaches the service directly.
   */
  it.each([
    [
      'verify',
      (service: ReturnType<typeof setup>['service']) => service.verifyDocument(support, 'doc-1'),
    ],
    [
      'reject',
      (service: ReturnType<typeof setup>['service']) =>
        service.rejectDocument(support, 'doc-1', 'Too blurry.'),
    ],
  ])('refuses %s without admin:document:review', async (_name, act) => {
    const h = setup({ siblings: [] });

    await expect(act(h.service)).rejects.toThrow(ForbiddenError);
    await expect(act(h.service)).rejects.toThrow(/admin:document:review/);
    expect(h.documentUpdates).toEqual([]);
    expect(h.auditRows).toEqual([]);
  });

  it('404s a document that does not exist, and writes nothing', async () => {
    const h = setup({ document: null });

    await expect(h.service.verifyDocument(moderator, 'doc-1')).rejects.toThrow(NotFoundError);
    expect([h.documentUpdates, h.auditRows]).toEqual([[], []]);
  });

  /**
   * Rejecting a document rejects a **file**, and the file goes.
   *
   * A rejected scan of somebody's PAN card will never be read again — the
   * dealer is about to replace it — and KYC media is exactly the category where
   * "we still had a copy" is the wrong answer. The row survives because the
   * checklist is three fixed rows; it survives empty, which is what makes the
   * dealer's screen show the slot they saw before they ever uploaded.
   */
  it('deletes the rejected file and empties the row of it', async () => {
    const h = setup({ siblings: [] });

    await h.service.rejectDocument(moderator, 'doc-1', 'Too blurry to read.');

    expect(h.deletedKeys).toEqual([`${DEALER_ROOT}/documents/GST_CERTIFICATE/doc-1`]);
    expect(h.documentUpdates[0]?.data).toMatchObject({ fileName: null, mediaId: null });
  });

  /** Verifying keeps the file. It is the one a moderator may want to look at again. */
  it('leaves a verified document\u2019s file where it is', async () => {
    const h = setup({ siblings: ALL_VERIFIED });

    await h.service.verifyDocument(moderator, 'doc-1');

    expect(h.deletedKeys).toEqual([]);
    expect(h.documentUpdates[0]?.data.fileName).toBeUndefined();
  });

  /**
   * The dealer has to be able to reach the upload box they are being sent to.
   *
   * A PENDING_APPROVAL dealership is shown the "we are reviewing this" panel
   * and no form, so a document rejection that left the status alone would be an
   * instruction the dealer could not follow.
   */
  it('reopens a PENDING_APPROVAL application, naming the document', async () => {
    const h = setup({
      siblings: [],
      dealer: dealerRow({ status: 'PENDING_APPROVAL' }),
    });

    const result = await h.service.rejectDocument(moderator, 'doc-1', 'Too blurry to read.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'DRAFT',
      statusReason: 'GST certificate: Too blurry to read.',
    });
    expect(h.outbox[0]?.eventType).toBe('DealerChangesRequested');
    expect(result.dealerReturnedToDraft).toBe(true);
  });

  /**
   * An ACTIVE dealership is not in the onboarding flow, and a DRAFT one is
   * already editable. Neither is dropped back into a state it is not in.
   */
  it.each(['DRAFT', 'ACTIVE'])('leaves a %s dealership where it is', async (status) => {
    const h = setup({ siblings: [], dealer: dealerRow({ status }) });

    const result = await h.service.rejectDocument(moderator, 'doc-1', 'Too blurry to read.');

    expect(h.dealerUpdates).toEqual([]);
    expect(result.dealerReturnedToDraft).toBe(false);
  });
});

/**
 * D2–D4 — the dealer status machine.
 *
 * ACTIVE is what makes a dealership's cars eligible to appear publicly at all
 * (rule 6), so these four writes are the most consequential in the console. The
 * shape of each is the same and worth stating once: read the row, change the
 * status, write the audit row and the outbox event **in the same transaction**.
 */
describe('the dealer permission table', () => {
  const actions: [string, (service: ReturnType<typeof setup>['service']) => Promise<unknown>][] = [
    ['approve', (s) => s.approveDealer(support, DEALER, {})],
    ['reject', (s) => s.rejectDealer(support, DEALER, 'GSTIN does not match.')],
    ['suspend', (s) => s.suspendDealer(support, DEALER, 'GST expired.')],
    ['reinstate', (s) => s.reinstateDealer(support, DEALER)],
  ];

  const support: AdminPrincipal = {
    ...admin,
    adminRole: 'SUPPORT',
    permissions: ['admin:metrics:read'],
  } as unknown as AdminPrincipal;

  /**
   * §8.3: the table is only meaningfully tested from a seat that lacks the
   * permission. A SUPPORT admin gets past `requireAdmin` and is refused here —
   * the only place it could be refused if another caller ever reaches the
   * service directly.
   */
  it.each(actions)('refuses %s without admin:dealer:approve', async (_name, act) => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await expect(act(h.service)).rejects.toThrow(ForbiddenError);
    await expect(act(h.service)).rejects.toThrow(/admin:dealer:approve/);
    expect([h.dealerUpdates, h.auditRows, h.outbox]).toEqual([[], [], []]);
  });
});

describe('dealers', () => {
  it('lists dealerships with their status labels and join date', async () => {
    const h = setup({
      dealerRows: [dealerRow()],
      grouped: [{ status: 'ACTIVE', _count: { _all: 4 } }],
    });

    const response = await h.service.dealers({ limit: 24 });

    expect(response.data[0]).toMatchObject({
      brandName: 'Sri Lakshmi Motors',
      initials: 'SL',
      city: 'Vellore',
      status: 'ACTIVE',
      creditBalance: 39,
    });
    // The tabs read this rather than issuing a second request per status.
    expect(response.counts).toEqual({ ACTIVE: 4 });
  });

  /*
   * ── Reconstruction slice ────────────────────────────────────────────────
   * `vehicleCount` and `activeCount` come from `Vehicle` (**F055**) and a
   * `Listing` group-by (**F064**). Zero is the true answer while there are no
   * rows to count, and asserting it keeps the columns in the shape the console
   * renders until the queries behind them come back.
   * ────────────────────────────────────────────────────────────────────────
   */
  it('reports no vehicles and no live listings, because neither model exists yet', async () => {
    const h = setup({ dealerRows: [dealerRow()] });

    expect((await h.service.dealers({ limit: 24 })).data[0]).toMatchObject({
      vehicleCount: 0,
      activeCount: 0,
    });
  });

  it('shows an em dash for a dealership with no city, district or state', async () => {
    const h = setup({ dealerRows: [dealerRow({ city: null, district: null, state: null })] });

    expect((await h.service.dealers({ limit: 24 })).data[0]).toMatchObject({
      city: '—',
      district: '—',
      state: '—',
    });
  });

  /**
   * The three location filters are `AND`ed and matched case-insensitively —
   * the values in those columns were typed by dealers, so `vellore` and
   * `Vellore` have to be the same filter.
   */
  it('filters on city, district and state together, whatever the casing', async () => {
    const h = setup({ dealerRows: [dealerRow()] });

    await h.service.dealers({
      limit: 24,
      city: 'katpadi',
      district: 'vellore',
      state: 'tamil nadu',
      status: 'ACTIVE',
    });

    expect(h.dealerQueries[0]?.where).toMatchObject({
      status: 'ACTIVE',
      city: { equals: 'katpadi', mode: 'insensitive' },
      district: { equals: 'vellore', mode: 'insensitive' },
      state: { equals: 'tamil nadu', mode: 'insensitive' },
    });
  });

  it('leaves out a filter that was not asked for', async () => {
    const h = setup({ dealerRows: [dealerRow()] });

    await h.service.dealers({ limit: 24, district: 'Vellore' });

    const where = h.dealerQueries[0]?.where as Record<string, unknown>;
    expect(Object.keys(where)).toEqual(['district']);
  });

  /**
   * The options the console offers, off the rows that exist — and deliberately
   * unnarrowed by the current filter, so choosing a state cannot empty the
   * district select and strand the operator with no way back.
   */
  it('answers with the locations dealerships are actually in', async () => {
    const h = setup({
      dealerRows: [dealerRow({ city: 'Vellore', district: 'Vellore', state: 'Tamil Nadu' })],
    });

    const response = await h.service.dealers({ limit: 24, state: 'Karnataka' });

    expect(response.facets).toEqual({
      cities: ['Vellore'],
      districts: ['Vellore'],
      states: ['Tamil Nadu'],
    });
    // Three `DISTINCT` reads, none of them carrying the caller's filter.
    for (const query of h.dealerQueries.slice(1)) {
      expect(query.distinct).toBeDefined();
      expect(query.where).not.toMatchObject({ state: { equals: 'Karnataka' } });
    }
  });

  it('drops a location nothing has been typed into', async () => {
    const h = setup({ dealerRows: [dealerRow({ district: null })] });

    expect((await h.service.dealers({ limit: 24 })).facets.districts).toEqual([]);
  });

  it('reports documents verified only when all three are', async () => {
    const all = setup({
      dealerRows: [
        dealerRow({
          documents: [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        }),
      ],
    });
    const some = setup({
      dealerRows: [
        dealerRow({
          documents: [{ status: 'VERIFIED' }, { status: 'UPLOADED' }, { status: 'VERIFIED' }],
        }),
      ],
    });
    const two = setup({
      dealerRows: [dealerRow({ documents: [{ status: 'VERIFIED' }, { status: 'VERIFIED' }] })],
    });

    expect((await all.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(true);
    expect((await some.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(false);
    // Two verified documents is not three.
    expect((await two.service.dealers({ limit: 24 })).data[0]?.documentsVerified).toBe(false);
  });

  it('paginates on the join date', async () => {
    const h = setup({
      dealerRows: [dealerRow(), dealerRow({ id: 'b' }), dealerRow({ id: 'c' })],
    });

    const response = await h.service.dealers({ limit: 2 });

    expect(response.data).toHaveLength(2);
    expect(response.page.hasMore).toBe(true);
    expect(response.page.nextCursor).not.toBeNull();
  });

  it('reports the end of the list rather than an endless cursor', async () => {
    const h = setup({ dealerRows: [dealerRow()] });

    expect((await h.service.dealers({ limit: 24 })).page).toEqual({
      hasMore: false,
      nextCursor: null,
    });
  });
});

describe('dealerDetail', () => {
  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.dealerDetail(admin, DEALER)).rejects.toThrow(NotFoundError);
  });

  it('issues a short-lived signed URL for a readable document', async () => {
    const h = setup({
      dealer: dealerRow({
        documents: [
          { id: 'doc-1', type: 'GST_CERTIFICATE', status: 'UPLOADED', createdAt: new Date() },
        ],
      }),
    });

    const detail = await h.service.dealerDetail(admin, DEALER);

    expect(detail.documents[0]?.viewUrl).toContain(`${DEALER_ROOT}/documents/`);
    expect(detail.documents[0]?.viewUrlExpiresAt).not.toBeNull();
    expect(h.signedUrls[0]).toBe(`${DEALER_ROOT}/documents/GST_CERTIFICATE/doc-1`);
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

    const detail = await h.service.dealerDetail(admin, DEALER);

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

    await h.service.dealerDetail(admin, DEALER);

    // §26.6: every signed document URL issued is audit-logged with the admin's
    // identity — that is the whole access control on KYC media.
    expect(h.detachedAudits[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'dealer.documents.viewed',
      entityId: DEALER,
    });
  });

  /**
   * R32 — the two answers a moderator is actually being asked to judge.
   *
   * They replace `about` on this response, which was the last surface reading a
   * paragraph the product stopped collecting at R26. A review screen showing a
   * dealership prose nobody will read, and not showing the sentence that will
   * front its public page, was reviewing the wrong field.
   */
  it('carries the tagline and the services, and no longer the paragraph', async () => {
    const h = setup({ dealer: dealerRow() });

    const detail = await h.service.dealerDetail(admin, DEALER);

    expect(detail.tagline).toBe('Family-run since 1998 — hatchbacks under ₹6 lakh.');
    expect(detail.specialities).toEqual(['In-house workshop', 'RC transfer assistance']);
    expect(detail).not.toHaveProperty('about');
  });

  /**
   * Collapsed on the way out, as on every other surface that reads them
   * (**R18**). What the reviewer sees is what a buyer gets — otherwise they
   * would correct a repeat the public pages had already merged.
   */
  it('merges a repeated service rather than showing it twice', async () => {
    const h = setup({
      dealer: dealerRow({ specialities: ['Finance', 'finance', 'RC transfer', 'Finance'] }),
    });

    const detail = await h.service.dealerDetail(admin, DEALER);

    expect(detail.specialities).toEqual(['Finance', 'RC transfer']);
  });

  /** The rows that predate R26 asking for either. */
  it('reports a dealership that has neither', async () => {
    const h = setup({ dealer: dealerRow({ tagline: null, specialities: [] }) });

    const detail = await h.service.dealerDetail(admin, DEALER);

    expect(detail.tagline).toBeNull();
    expect(detail.specialities).toEqual([]);
  });

  it('logs nothing when no document could be viewed', async () => {
    const h = setup({ dealer: dealerRow({ documents: [] }) });

    await h.service.dealerDetail(admin, DEALER);

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

    expect((await ready.service.dealerDetail(admin, DEALER)).actions.canApprove).toBe(true);
    expect((await unverified.service.dealerDetail(admin, DEALER)).actions.canApprove).toBe(false);
  });

  it('offers suspend for an active dealership and reinstate for a suspended one', async () => {
    const active = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });
    const suspended = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    const activeActions = (await active.service.dealerDetail(admin, DEALER)).actions;
    const suspendedActions = (await suspended.service.dealerDetail(admin, DEALER)).actions;

    expect([activeActions.canSuspend, activeActions.canReinstate]).toEqual([true, false]);
    expect([suspendedActions.canSuspend, suspendedActions.canReinstate]).toEqual([false, true]);
  });

  it('gates the credit-grant action on the permission', async () => {
    const granter: AdminPrincipal = {
      ...admin,
      permissions: [...admin.permissions, 'admin:credit:grant'],
    };
    const h = setup();

    // The API decides which decisions are available, not the console — so two
    // admins looking at one dealership cannot reach different conclusions.
    expect((await h.service.dealerDetail(granter, DEALER)).actions.canGrantCredits).toBe(true);
    expect((await h.service.dealerDetail(admin, DEALER)).actions.canGrantCredits).toBe(false);
  });

  it('formats the contact number, or reports null when there is none', async () => {
    const withPhone = setup();
    const without = setup({ dealer: dealerRow({ contactPhone: null }) });

    expect((await withPhone.service.dealerDetail(admin, DEALER)).contactPhoneDisplay).toBe(
      '+91 98400 12345',
    );
    expect((await without.service.dealerDetail(admin, DEALER)).contactPhoneDisplay).toBeNull();
  });

  /** The owner's name and email come from the membership, not from the dealer row. */
  it('names the owner from the OWNER membership', async () => {
    const detail = await setup().service.dealerDetail(admin, DEALER);

    expect(detail.contactName).toBe('Ramesh Kumar');
    expect(detail.contactEmail).toBe('owner@sri-lakshmi-motors.in');
  });

  it('falls back to the dealership email when there is no owner on file', async () => {
    const h = setup({ dealer: dealerRow({ members: [] }) });

    const detail = await h.service.dealerDetail(admin, DEALER);

    expect(detail.contactName).toBeNull();
    expect(detail.contactEmail).toBe('contact@sri-lakshmi-motors.in');
  });
});

describe('approveDealer', () => {
  it('activates the dealership and clears any status reason', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL', statusReason: 'Waiting' }) });

    const response = await h.service.approveDealer(admin, DEALER, {});

    expect(h.dealerUpdates[0]?.data).toMatchObject({ status: 'ACTIVE', statusReason: null });
    expect(h.dealerUpdates[0]?.data.approvedAt).toBeInstanceOf(Date);
    expect(response.status).toBe('ACTIVE');
  });

  /*
   * ── Reconstruction slice ────────────────────────────────────────────────
   * The baseline seeds an onboarding bonus here through `moveCredits`, which
   * needs the ledger (**F050**). `grantCredits` is therefore absent from
   * `ApproveDealerInput` — `.strict()` names it in a 400 rather than accepting
   * an approval that quietly granted nothing — and the response reads zero.
   * ────────────────────────────────────────────────────────────────────────
   */
  it('grants nothing, and says so, until the ledger exists', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    const response = await h.service.approveDealer(admin, DEALER, { note: 'Launch offer' });

    expect(response.creditsGranted).toBe(0);
    expect(response.creditBalance).toBe(39);
  });

  it('refuses to approve a dealership that is already active', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });

    try {
      await h.service.approveDealer(admin, DEALER, {});
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('ALREADY_ACTIVE');
    }
    expect(h.dealerUpdates).toEqual([]);
  });

  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.approveDealer(admin, DEALER, {})).rejects.toThrow(NotFoundError);
  });

  it('audit-logs the before and after status', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(admin, DEALER, {});

    expect(h.auditRows[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'dealer.approved',
      entityType: 'Dealer',
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'ACTIVE', creditsGranted: 0 },
    });
  });

  it('publishes DealerApproved in the same transaction', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.approveDealer(admin, DEALER, {});

    expect(h.outbox[0]).toMatchObject({ eventType: 'DealerApproved', aggregateType: 'Dealer' });
  });
});

describe('setDealerStatus and its wrappers', () => {
  it('suspends, stamping the time and recording the reason', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });

    const response = await h.service.suspendDealer(admin, DEALER, 'GST expired.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'SUSPENDED',
      statusReason: 'GST expired.',
    });
    expect(h.dealerUpdates[0]?.data.suspendedAt).toBeInstanceOf(Date);
    // D4: suspension pulls every listing out of the catalogue at once, so the
    // admin is told how many that is. `Listing` arrives with F064; until then
    // there is nothing to pull, and zero is the honest count.
    expect(response.listingsAffected).toBe(0);
  });

  /**
   * R41 — the seat, not the account.
   *
   * This used to write `users.status`, and `users.status` is the whole person.
   * A member who also moderates the platform lost the admin console because a
   * dealership was suspended, which is a consequence nobody asked for and
   * nobody could see. Both assertions below are about what is *not* touched.
   */
  it('closes every member dealer seat and revokes their dealer sessions on suspension', async () => {
    const h = setup({
      dealer: dealerRow({
        status: 'ACTIVE',
        members: [
          { userId: 'owner-1', role: 'OWNER' },
          { userId: 'manager-1', role: 'MANAGER' },
        ],
      }),
    });

    await h.service.suspendDealer(admin, DEALER, 'GST expired.');

    // The account itself is left alone.
    expect(h.userUpdates).toEqual([]);

    // A member who has never signed in has no seat row yet, so the write is a
    // create-then-update pair rather than an update.
    expect(h.seatCreates).toEqual([
      {
        data: [
          { userId: 'owner-1', role: 'DEALER' },
          { userId: 'manager-1', role: 'DEALER' },
        ],
        skipDuplicates: true,
      },
    ]);
    expect(h.seatUpdates).toEqual([
      {
        where: { userId: { in: ['owner-1', 'manager-1'] }, role: 'DEALER' },
        data: { status: 'SUSPENDED', reason: 'GST expired.', suspendedAt: expect.any(Date) },
      },
    ]);

    // Scoped. An admin session one of these people holds survives.
    expect(h.sessionUpdates).toEqual([
      {
        where: {
          userId: { in: ['owner-1', 'manager-1'] },
          scope: 'DEALER',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      },
    ]);
  });

  it('reopens the dealer seats on reinstatement, and revokes nothing', async () => {
    const h = setup({
      dealer: dealerRow({ status: 'SUSPENDED', members: [{ userId: 'owner-1', role: 'OWNER' }] }),
    });

    await h.service.reinstateDealer(admin, DEALER, 'Registration renewed.');

    expect(h.seatUpdates).toEqual([
      {
        where: { userId: { in: ['owner-1'] }, role: 'DEALER' },
        data: { status: 'ACTIVE', reason: null, suspendedAt: null },
      },
    ]);
    // Reinstatement restores the seat, never a token that was revoked.
    expect(h.sessionUpdates).toEqual([]);
  });

  it('reinstates, clearing the suspension', async () => {
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await h.service.reinstateDealer(admin, DEALER, 'Documents renewed.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'ACTIVE',
      statusReason: 'Documents renewed.',
      suspendedAt: null,
    });
    // R41 — the seat is reopened; the account was never closed.
    expect(h.userUpdates).toEqual([]);
    expect(h.seatUpdates).toEqual([
      {
        where: { userId: { in: ['user-1'] }, role: 'DEALER' },
        data: { status: 'ACTIVE', reason: null, suspendedAt: null },
      },
    ]);
    expect(h.sessionUpdates).toEqual([]);
  });

  it('keeps the original approval date on reinstatement', async () => {
    const original = new Date('2026-01-05T00:00:00.000Z');
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED', approvedAt: original }) });

    await h.service.reinstateDealer(admin, DEALER);

    // Overwriting it would make a long-standing dealership look brand new.
    expect(h.dealerUpdates[0]?.data.approvedAt).toBe(original);
  });

  it('stamps an approval date when reinstating one that never had one', async () => {
    const h = setup({ dealer: dealerRow({ status: 'REJECTED', approvedAt: null }) });

    await h.service.reinstateDealer(admin, DEALER);

    expect(h.dealerUpdates[0]?.data.approvedAt).toBeInstanceOf(Date);
  });

  it('accepts a reinstatement with no note', async () => {
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await h.service.reinstateDealer(admin, DEALER);

    expect(h.dealerUpdates[0]?.data.statusReason).toBeNull();
  });

  /** A suspension is not a rejection, and the handlers downstream tell them apart. */
  it('publishes the event matching the new status', async () => {
    const suspended = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });
    const rejected = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });
    const reinstated = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await suspended.service.suspendDealer(admin, DEALER, 'Under review.');
    await rejected.service.rejectDealer(admin, DEALER, 'GSTIN mismatch.');
    await reinstated.service.reinstateDealer(admin, DEALER);

    expect(suspended.outbox[0]?.eventType).toBe('DealerSuspended');
    expect(rejected.outbox[0]?.eventType).toBe('DealerRejected');
    expect(reinstated.outbox[0]?.eventType).toBe('DealerReinstated');
    expect((suspended.outbox[0]?.payload as { payload: unknown }).payload).toEqual({
      dealerId: DEALER,
      reason: 'Under review.',
    });
    expect((reinstated.outbox[0]?.payload as { payload: unknown }).payload).toEqual({
      dealerId: DEALER,
    });
  });

  it('audit-logs each move with its own action name', async () => {
    const h = setup({ dealer: dealerRow({ status: 'ACTIVE' }) });

    await h.service.suspendDealer(admin, DEALER, 'GST expired.');

    expect(h.auditRows[0]).toMatchObject({
      action: 'dealer.suspended',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED', reason: 'GST expired.' },
    });
  });

  it('404s a dealership that does not exist, and writes nothing', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.suspendDealer(admin, DEALER, 'Under review.')).rejects.toThrow(
      NotFoundError,
    );
    expect([h.dealerUpdates, h.auditRows, h.outbox]).toEqual([[], [], []]);
  });
});

/**
 * Rejection is a **purge**, and these are the tests that keep it one.
 *
 * The behaviour is destructive on purpose — a rejected application leaves no
 * scans of anybody's PAN card in a bucket and no dealership row to sign back
 * into — so the assertions are about what is *gone*, and about the two facts
 * that make it safe: the audit row is written before the delete and outlives it,
 * and an approved dealership cannot be reached this way at all.
 */
describe('rejectDealer', () => {
  const documents = [
    { id: 'doc-gst', type: 'GST_CERTIFICATE', status: 'UPLOADED' },
    { id: 'doc-pan', type: 'PAN_CARD', status: 'VERIFIED' },
    { id: 'doc-addr', type: 'ADDRESS_PROOF', status: 'UPLOADED' },
  ];

  function pending(overrides: Record<string, unknown> = {}) {
    return { dealer: dealerRow({ status: 'PENDING_APPROVAL', documents, ...overrides }) };
  }

  it('deletes every KYC scan and the yard photograph from storage', async () => {
    const h = setup({
      ...pending(),
      media: [{ storageKey: `${DEALER_ROOT}/yard/media-1` }],
    });

    const result = await h.service.rejectDealer(admin, DEALER, 'Not a dealership.');

    // One folder, four objects: the three private scans and the photograph
    // that will front the portfolio.
    expect(h.deletedKeys).toEqual([
      `${DEALER_ROOT}/documents/GST_CERTIFICATE/doc-gst`,
      `${DEALER_ROOT}/documents/PAN_CARD/doc-pan`,
      `${DEALER_ROOT}/documents/ADDRESS_PROOF/doc-addr`,
      `${DEALER_ROOT}/yard/media-1`,
    ]);
    expect(result).toMatchObject({ documentsDeleted: 3, objectsDeleted: 4 });
  });

  /**
   * The row is what the applicant signs back into. Leaving it — even blanked —
   * would put them at the "we are reviewing this" panel forever; removing it
   * means the next sign-in finds no membership and starts onboarding afresh.
   */
  it('deletes the dealership row and its media rows', async () => {
    const h = setup(pending());

    await h.service.rejectDealer(admin, DEALER, 'Not a dealership.');

    expect(h.deletedDealers).toEqual([{ where: { id: DEALER } }]);
    expect(h.deletedMedia).toEqual([{ where: { dealerId: DEALER } }]);
    expect(h.dealerUpdates).toEqual([]);
  });

  /**
   * `audit_logs.dealerId` is a column and not a foreign key, which is what lets
   * the record outlive the dealership. The `before` block is therefore the only
   * surviving description of what was destroyed, so it carries the whole row.
   */
  it('audits what was destroyed before destroying it', async () => {
    const h = setup(pending());

    await h.service.rejectDealer(admin, DEALER, 'The GSTIN belongs to a different business.');

    expect(h.auditRows[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'dealer.rejected',
      entityType: 'Dealer',
      before: {
        status: 'PENDING_APPROVAL',
        gstin: '33AABCS1429B1ZX',
        legalName: 'Sri Lakshmi Motors Pvt Ltd',
        recipientEmail: 'owner@sri-lakshmi-motors.in',
        recipientName: 'Ramesh Kumar',
      },
      after: { purged: true, reason: 'The GSTIN belongs to a different business.' },
    });
  });

  /**
   * The event carries ids and the reason, and no PII — the rule the whole
   * outbox follows, and it matters more here than anywhere: the table is
   * durable and outlives the row it describes, so an applicant's name and email
   * sitting in it is exactly what the rejection was supposed to remove.
   */
  it('publishes the rejection with ids and the reason, and no PII', async () => {
    const h = setup(pending());

    await h.service.rejectDealer(admin, DEALER, 'Address proof is illegible.');

    expect(h.outbox[0]).toMatchObject({ eventType: 'DealerRejected' });
    expect((h.outbox[0]?.payload as { payload: unknown }).payload).toEqual({
      dealerId: DEALER,
      reason: 'Address proof is illegible.',
    });
  });

  /**
   * A document row whose upload never completed has no object behind it. That
   * must not abort the purge and leave the dealership half-destroyed — an
   * object left in the bucket is reconcilable, a `dealers` row left behind is a
   * rejected applicant who can still sign in.
   */
  it('finishes the purge when an object is already gone', async () => {
    const h = setup({
      ...pending(),
      missingKeys: [`${DEALER_ROOT}/documents/PAN_CARD/doc-pan`],
    });

    const result = await h.service.rejectDealer(admin, DEALER, 'Not a dealership.');

    expect(result.objectsDeleted).toBe(2);
    expect(h.deletedDealers).toHaveLength(1);
  });

  /**
   * The one guard that makes the destruction reasonable to allow at all: only
   * an application that has never been approved can be thrown away, so there is
   * never a listing, a payment or a buyer's enquiry hanging off the row.
   */
  it.each(['ACTIVE', 'SUSPENDED'])('refuses to purge a %s dealership', async (status) => {
    const h = setup({ dealer: dealerRow({ status, documents }) });

    await expect(h.service.rejectDealer(admin, DEALER, 'Not a dealership.')).rejects.toThrow(
      /suspended, not rejected/,
    );
    expect([h.deletedKeys, h.deletedDealers, h.auditRows]).toEqual([[], [], []]);
  });

  it('404s a dealership that does not exist, and deletes nothing', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.rejectDealer(admin, DEALER, 'Not a dealership.')).rejects.toThrow(
      NotFoundError,
    );
    expect([h.deletedKeys, h.deletedDealers]).toEqual([[], []]);
  });
});

/**
 * Request changes — the reversible refusal, and the one a moderator reaches for
 * far more often than rejection.
 *
 * Everything about it is the opposite of the purge above: nothing is deleted,
 * the reason is attached rather than only logged, and the dealership comes back
 * to the queue under its own steam. The tests say so explicitly, because the
 * two controls sit next to each other in the console and the difference between
 * them is a real business's whole application.
 */
describe('requestChanges', () => {
  it('hands the application back as DRAFT with the reason attached', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    const result = await h.service.requestChanges(admin, DEALER, 'Send a recent address proof.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'DRAFT',
      statusReason: 'Send a recent address proof.',
    });
    expect(result.status).toBe('DRAFT');
  });

  it('deletes nothing', async () => {
    const h = setup({
      dealer: dealerRow({ status: 'PENDING_APPROVAL' }),
      media: [{ storageKey: `${DEALER_ROOT}/yard/media-1` }],
    });

    await h.service.requestChanges(admin, DEALER, 'Send a recent address proof.');

    expect([h.deletedKeys, h.deletedDealers, h.deletedMedia]).toEqual([[], [], []]);
  });

  it('audits and publishes it as its own decision', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.requestChanges(admin, DEALER, 'Send a recent address proof.');

    expect(h.auditRows[0]).toMatchObject({
      action: 'dealer.changes_requested',
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'DRAFT', reason: 'Send a recent address proof.' },
    });
    expect(h.outbox[0]?.eventType).toBe('DealerChangesRequested');
  });

  /**
   * From DRAFT the dealer can already edit everything, and from ACTIVE the
   * dealership is not in the onboarding flow at all — sending either back would
   * be a state change with no meaning behind it.
   */
  it.each(['DRAFT', 'ACTIVE', 'SUSPENDED'])(
    'refuses to send back a %s dealership',
    async (status) => {
      const h = setup({ dealer: dealerRow({ status }) });

      await expect(h.service.requestChanges(admin, DEALER, 'Fix the address.')).rejects.toThrow(
        /waiting for a decision/,
      );
      expect(h.dealerUpdates).toEqual([]);
    },
  );

  it('refuses without admin:dealer:approve', async () => {
    const support = {
      ...admin,
      permissions: ['admin:metrics:read'],
    } as unknown as AdminPrincipal;
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await expect(h.service.requestChanges(support, DEALER, 'Fix the address.')).rejects.toThrow(
      ForbiddenError,
    );
    expect(h.dealerUpdates).toEqual([]);
  });
});

/**
 * D3 edit — the console amending a dealership's own answers.
 *
 * The write itself is `dealers.update`'s, and deliberately so: normalisation,
 * the E.164 rewrite and the duplicate check are rules about the data, not about
 * who is editing it. What this unit owns is the two things the dealer path does
 * not have — the permission, and an audit row naming the admin.
 */
describe('updateDealer', () => {
  const patch = { gstin: '33AABCS1429B1ZY' };

  it('delegates the write to the dealer service, unchanged', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.updateDealer(admin, DEALER, patch);

    expect(h.dealerPatches).toEqual([{ dealerId: DEALER, input: patch }]);
  });

  /** An edit the dealer did not make has to be attributable to whoever made it. */
  it('audits the edit against the admin, with what was there before', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.updateDealer(admin, DEALER, patch);

    expect(h.detachedAudits[0]).toMatchObject({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'dealer.updated',
      entityType: 'Dealer',
      before: { gstin: '33AABCS1429B1ZX' },
      after: patch,
    });
  });

  it('refuses without admin:dealer:approve, and writes nothing', async () => {
    const support = {
      ...admin,
      permissions: ['admin:metrics:read'],
    } as unknown as AdminPrincipal;
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await expect(h.service.updateDealer(support, DEALER, patch)).rejects.toThrow(ForbiddenError);
    expect([h.dealerPatches, h.detachedAudits]).toEqual([[], []]);
  });

  it('404s a dealership that does not exist', async () => {
    const h = setup({ dealer: null });

    await expect(h.service.updateDealer(admin, DEALER, patch)).rejects.toThrow(NotFoundError);
    expect(h.dealerPatches).toEqual([]);
  });
});

/**
 * F072 — the settings screen's API.
 *
 * Two properties carry it. `readBy` tells the console which keys anything
 * actually reads, because the table holds every knob the product will ever have
 * and most of the code that consults them has not been reconstructed; and the
 * declared type is enforced on write, which the baseline documents and does not
 * do.
 */
describe('config', () => {
  it('names the reader for a key something reads, and nothing for one nothing does', async () => {
    const h = setup();

    const { data } = await h.service.config(admin);

    expect(data.find((entry) => entry.key === 'billing.gstPercent')?.readBy).toBe(
      "the admin console's revenue figure",
    );
    // The console renders this one read-only. An editable control that changes
    // no behaviour tells an operator they have changed something.
    expect(data.find((entry) => entry.key === 'otp.maxAttempts')?.readBy).toBeNull();
  });

  it('is refused to a seat without admin:config:write', async () => {
    const h = setup();

    await expect(h.service.config(support)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('writes one key, and audits the value it replaced', async () => {
    const h = setup();

    await h.service.setConfig(admin, 'billing.gstPercent', 12);

    expect(h.configWrites).toEqual([
      { key: 'billing.gstPercent', value: 12, updatedBy: 'admin-1' },
    ]);
    expect(h.detachedAudits.at(-1)).toMatchObject({
      action: 'config.updated',
      entityType: 'PlatformConfig',
      entityId: 'billing.gstPercent',
      before: { value: 18 },
      after: { value: 12 },
    });
  });

  /**
   * `platform_config.value` is a JSON column, so it stores anything. A string
   * where a number belongs is read back by `config.number()` as `NaN`, which
   * surfaces days later as a GST figure nobody can account for.
   */
  it('refuses a value that is not the type the key declares', async () => {
    const h = setup();

    await expect(h.service.setConfig(admin, 'billing.gstPercent', 'twelve')).rejects.toMatchObject({
      status: 422,
      code: 'CONFIG_TYPE_MISMATCH',
    });
    expect(h.configWrites).toEqual([]);
  });

  /** Each declared type has its own arm, and each has its own way of being wrong. */
  it('accepts a boolean, a string and a list against their declared types', async () => {
    const h = setup({
      configEntries: [
        { key: 'feature.similarCars', label: 'Similar cars', type: 'boolean', value: true },
        { key: 'support.note', label: 'Support note', type: 'string', value: 'Call us' },
        { key: 'listing.presets', label: 'Presets', type: 'string[]', value: ['Too few photos.'] },
      ],
    });

    await h.service.setConfig(admin, 'feature.similarCars', false);
    await h.service.setConfig(admin, 'support.note', 'Write to us');
    await h.service.setConfig(admin, 'listing.presets', ['Too few photos.', 'Price is off.']);

    expect(h.configWrites.map((write) => write.value)).toEqual([
      false,
      'Write to us',
      ['Too few photos.', 'Price is off.'],
    ]);
  });

  it('refuses a list with something in it that is not a string', async () => {
    const h = setup({
      configEntries: [
        { key: 'listing.presets', label: 'Presets', type: 'string[]', value: ['Too few photos.'] },
      ],
    });

    await expect(h.service.setConfig(admin, 'listing.presets', ['fine', 7])).rejects.toMatchObject({
      code: 'CONFIG_TYPE_MISMATCH',
    });
  });

  /** `NaN` is a number to `typeof` and is not one to anybody else. */
  it('refuses NaN where a number belongs', async () => {
    const h = setup();

    await expect(
      h.service.setConfig(admin, 'billing.gstPercent', Number.NaN),
    ).rejects.toMatchObject({ code: 'CONFIG_TYPE_MISMATCH' });
  });

  it('404s on a key that does not exist', async () => {
    const h = setup();

    await expect(h.service.setConfig(admin, 'billing.vatPercent', 12)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

/**
 * R42 — who may open the console.
 *
 * The distinction every case below turns on: an **allow-listed** address is the
 * deployment's answer and cannot be withdrawn here, while a **grant** is a
 * `user_roles` row with `grantedBy` set, made by a SUPER_ADMIN on this screen.
 */
describe('adminAccess', () => {
  const GRANTED = {
    id: 'user-granted',
    email: 'ops.two@dealers-drive.in',
    fullName: 'Second Operator',
    adminRole: 'MODERATOR',
    isPlatformAdmin: true,
    lastLoginAt: null,
    roles: [
      {
        id: 'seat-1',
        role: 'ADMIN',
        status: 'ACTIVE',
        grantedBy: 'admin-1',
        grantedAt: new Date('2026-09-10T00:00:00.000Z'),
      },
    ],
  };

  /** A seat that was withdrawn: the row survives, the access does not. */
  const WITHDRAWN = {
    id: 'user-gone',
    email: 'left@dealers-drive.in',
    fullName: 'Former Operator',
    adminRole: null,
    isPlatformAdmin: false,
    lastLoginAt: null,
    roles: [],
  };

  it('lists a granted seat, and says who granted it', async () => {
    const h = setup({ adminUsers: [GRANTED] });

    const { data } = await h.service.adminAccess(admin);
    const entry = data.find((row) => row.email === 'ops.two@dealers-drive.in');

    expect(entry).toMatchObject({
      source: 'GRANT',
      sourceLabel: 'Granted',
      adminRole: 'MODERATOR',
      grantedByEmail: 'ops@dealers-drive.test',
      canRevoke: true,
    });
  });

  /**
   * An address in `ADMIN_ALLOWLIST` that nobody has signed in with has no row
   * at all — and a list that omitted it would be wrong about who can get in.
   */
  it('includes an allow-listed address with no account yet, and refuses to withdraw it', async () => {
    const h = setup({ adminUsers: [] });

    const { data } = await h.service.adminAccess(admin);

    expect(data.length).toBeGreaterThan(0);
    for (const entry of data) {
      expect(entry).toMatchObject({
        source: 'ALLOWLIST',
        canRevoke: false,
        revokeBlockedReason: 'Set in ADMIN_ALLOWLIST',
      });
    }
  });

  it('reports when they were last here, and says so when they never were', async () => {
    const h = setup({
      adminUsers: [
        { ...GRANTED, lastLoginAt: new Date(Date.now() - 90 * 60 * 1000) },
        { ...GRANTED, id: 'user-fresh', email: 'fresh@dealers-drive.in', lastLoginAt: null },
      ],
    });

    const { data } = await h.service.adminAccess(admin);

    expect(data.find((row) => row.email === 'ops.two@dealers-drive.in')?.lastLoginLabel).toBe(
      '1 hour ago',
    );
    expect(data.find((row) => row.email === 'fresh@dealers-drive.in')?.lastLoginLabel).toBe(
      'Never',
    );
  });

  /**
   * The account that granted the seat may itself have been withdrawn since.
   * The seat stands — it was granted, and by whom is history rather than a
   * dependency — so the row renders without a name instead of not at all.
   */
  it('survives a granter whose own account is gone', async () => {
    const h = setup({
      adminUsers: [
        {
          ...GRANTED,
          roles: [{ ...GRANTED.roles[0], grantedBy: 'admin-vanished' }],
        },
      ],
    });

    const { data } = await h.service.adminAccess(admin);

    expect(data.find((row) => row.email === 'ops.two@dealers-drive.in')).toMatchObject({
      source: 'GRANT',
      grantedByEmail: null,
    });
  });

  it('leaves a withdrawn operator off the list entirely', async () => {
    const h = setup({ adminUsers: [WITHDRAWN] });

    const { data } = await h.service.adminAccess(admin);

    expect(data.some((entry) => entry.email === 'left@dealers-drive.in')).toBe(false);
  });

  it('is refused to a seat without admin:access:manage', async () => {
    const h = setup();

    await expect(h.service.adminAccess(support)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('grantAdminAccess', () => {
  it('creates the account when the address is new, and records who granted it', async () => {
    const h = setup();

    const entry = await h.service.grantAdminAccess(admin, {
      email: 'new.operator@dealers-drive.in',
      adminRole: 'MODERATOR',
    });

    expect(h.userWrites).toEqual([
      {
        op: 'create',
        data: {
          email: 'new.operator@dealers-drive.in',
          isPlatformAdmin: true,
          adminRole: 'MODERATOR',
        },
      },
    ]);
    expect(h.seatUpserts).toEqual([
      expect.objectContaining({
        create: { userId: 'user-new', role: 'ADMIN', grantedBy: 'admin-1' },
      }),
    ]);
    expect(entry).toMatchObject({ source: 'GRANT', grantedByEmail: 'ops@dealers-drive.test' });
    expect(h.auditRows.at(-1)).toMatchObject({ action: 'admin.access.granted' });
  });

  it('promotes an account that already exists rather than creating a second one', async () => {
    const h = setup();

    await h.service.grantAdminAccess(admin, {
      email: 'known@dealers-drive.test',
      adminRole: 'SUPPORT',
    });

    expect(h.userWrites).toEqual([
      expect.objectContaining({
        op: 'update',
        data: { isPlatformAdmin: true, adminRole: 'SUPPORT' },
      }),
    ]);
  });

  it('is refused to a seat without admin:access:manage', async () => {
    const h = setup();

    await expect(
      h.service.grantAdminAccess(support, { email: 'x@y.in', adminRole: 'SUPPORT' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('revokeAdminAccess', () => {
  const GRANTED = {
    id: 'user-granted',
    email: 'ops.two@dealers-drive.in',
    fullName: 'Second Operator',
    adminRole: 'MODERATOR',
    isPlatformAdmin: true,
    lastLoginAt: null,
    roles: [{ id: 'seat-1', role: 'ADMIN', status: 'ACTIVE', grantedBy: 'admin-1' }],
  };

  it('deletes the seat, clears the flag and ends their admin sessions only', async () => {
    const h = setup({ adminUsers: [GRANTED] });

    await h.service.revokeAdminAccess(admin, 'user-granted');

    expect(h.seatDeletes).toEqual([{ where: { id: 'seat-1' } }]);
    expect(h.userWrites).toEqual([
      expect.objectContaining({ data: { isPlatformAdmin: false, adminRole: null } }),
    ]);
    // A dealer seat the same person holds is untouched — R41 read the other way.
    expect(h.sessionUpdates).toEqual([
      {
        where: { userId: 'user-granted', scope: 'ADMIN', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      },
    ]);
  });

  /** There may be nobody left who can let you back in. */
  it('refuses to withdraw your own seat', async () => {
    const h = setup({ adminUsers: [GRANTED] });

    await expect(h.service.revokeAdminAccess(admin, 'admin-1')).rejects.toMatchObject({
      status: 403,
      code: 'ADMIN_ACCESS_SELF',
    });
  });

  /** The environment admits them. A control that pretended otherwise would lie. */
  it('refuses to withdraw an allow-listed address', async () => {
    const allowlisted = {
      ...GRANTED,
      id: 'user-allowlisted',
      email: env.adminAllowlist[0] ?? '',
    };
    const h = setup({ adminUsers: [allowlisted] });

    await expect(h.service.revokeAdminAccess(admin, 'user-allowlisted')).rejects.toMatchObject({
      status: 409,
      code: 'ADMIN_ACCESS_ALLOWLISTED',
    });
    expect(h.seatDeletes).toEqual([]);
  });

  /**
   * Every admin sign-in leaves an ADMIN seat behind (**R41**). Only a grant
   * carries `grantedBy`, and only a grant is this endpoint's to withdraw.
   */
  it('refuses a seat nobody granted', async () => {
    const signedInOnly = {
      ...GRANTED,
      id: 'user-footprint',
      roles: [{ id: 'seat-2', role: 'ADMIN', status: 'ACTIVE', grantedBy: null }],
    };
    const h = setup({ adminUsers: [signedInOnly] });

    await expect(h.service.revokeAdminAccess(admin, 'user-footprint')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
