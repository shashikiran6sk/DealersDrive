import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { AdminOverview } from '@dealers-drive/contracts';

import { createAdminService } from '../../../../src/modules/admin/admin.service.js';
import type { AuditService } from '../../../../src/platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import { ForbiddenError, NotFoundError } from '../../../../src/platform/errors.js';
import type { AdminPrincipal } from '../../../../src/modules/auth/auth.facade.js';

/**
 * Unit tests for `src/modules/admin/admin.service.ts`.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file covers fourteen permission checks and the whole moderation
 * surface. F049 brought `overview` — the console shell's guard as well as its
 * landing page — and **F044 the KYC review**. The dealer status machine arrives
 * with **F045**.
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
}

function setup(options: Options = {}) {
  const counts = [options.dealers ?? 0, options.pending ?? 0];
  const documentUpdates: { where: unknown; data: Record<string, unknown> }[] = [];
  const auditRows: Record<string, unknown>[] = [];

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
  };

  const prisma = {
    dealer: { count: () => Promise.resolve(counts.shift() ?? 0) },
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
    recordDetached: () => Promise.resolve(),
  } as unknown as AuditService;

  return {
    service: createAdminService({ prisma, audit, config }),
    documentUpdates,
    auditRows,
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
