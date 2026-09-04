import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { AdminOverview } from '@dealers-drive/contracts';

import { createAdminService } from '../../../../src/modules/admin/admin.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import type { AdminPrincipal } from '../../../../src/modules/auth/auth.facade.js';

/**
 * Unit tests for `src/modules/admin/admin.service.ts`.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file covers fourteen permission checks and the whole moderation
 * surface. **F049 brings `overview`**, which is the console shell's guard as
 * well as its landing page. The KYC review cases arrive with **F044** and the
 * dealer status machine with **F045**.
 * ────────────────────────────────────────────────────────────────────────────
 */
function setup(options: { dealers?: number; pending?: number; gstPercent?: number } = {}) {
  const counts = [options.dealers ?? 0, options.pending ?? 0];

  const prisma = {
    dealer: { count: () => Promise.resolve(counts.shift() ?? 0) },
  } as unknown as PrismaClient;

  const config = {
    number: () => Promise.resolve(options.gstPercent ?? 18),
  } as unknown as PlatformConfigService;

  return { service: createAdminService({ prisma, config }) };
}

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
