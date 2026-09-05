import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { AdminOverview } from '@dealers-drive/contracts';

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
}

const DEALER = '4bafe791-892d-4696-8309-ee23f172211b';

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
    city: 'Vellore',
    state: 'Tamil Nadu',
    documents: [],
    members: [{ user: { fullName: 'Ramesh Kumar', email: 'owner@sri-lakshmi-motors.in' } }],
    ...overrides,
  };
}

function setup(options: Options = {}) {
  const counts = [options.dealers ?? 0, options.pending ?? 0];
  const documentUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const dealerUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const auditRows: Record<string, unknown>[] = [];
  const detachedAudits: Record<string, unknown>[] = [];
  const outbox: Record<string, unknown>[] = [];
  const signedUrls: string[] = [];

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
  };

  const prisma = {
    dealer: {
      count: () => Promise.resolve(counts.shift() ?? 0),
      findMany: () => Promise.resolve(options.dealerRows ?? []),
      findUnique: resolveDealer,
      groupBy: () => Promise.resolve(options.grouped ?? []),
    },
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
  } as unknown as PrismaClient;

  const config = {
    number: () => Promise.resolve(options.gstPercent ?? 18),
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
  } as unknown as StoragePort;

  return {
    service: createAdminService({ prisma, audit, config, storage }),
    documentUpdates,
    dealerUpdates,
    auditRows,
    detachedAudits,
    outbox,
    signedUrls,
  };
}

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
  permissions: ['admin:metrics:read', 'admin:dealer:approve'],
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

  it('shows an em dash for a dealership with no city', async () => {
    const h = setup({ dealerRows: [dealerRow({ city: null })] });

    expect((await h.service.dealers({ limit: 24 })).data[0]?.city).toBe('—');
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

  it('reinstates, clearing the suspension', async () => {
    const h = setup({ dealer: dealerRow({ status: 'SUSPENDED' }) });

    await h.service.reinstateDealer(admin, DEALER, 'Documents renewed.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'ACTIVE',
      statusReason: 'Documents renewed.',
      suspendedAt: null,
    });
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

  it('rejects with the reason recorded', async () => {
    const h = setup({ dealer: dealerRow({ status: 'PENDING_APPROVAL' }) });

    await h.service.rejectDealer(admin, DEALER, 'GSTIN does not match.');

    expect(h.dealerUpdates[0]?.data).toMatchObject({
      status: 'REJECTED',
      statusReason: 'GSTIN does not match.',
    });
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
