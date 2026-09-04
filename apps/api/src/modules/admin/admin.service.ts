import {
  formatRupees,
  type AdminOverview,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';

/**
 * D1–D15. The platform's own console.
 *
 * This is the one module that reads across tenants, and it does so
 * deliberately: every write records who did it, and the permission table (§8.3)
 * is narrower than "is an admin" — granting credits and changing configuration
 * are SUPER_ADMIN only, while a SUPPORT admin can read metrics and nothing
 * else.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~1,320 lines across metrics, dealer moderation, KYC
 * review, the listing queue, credit grants, payments, configuration and the
 * audit log. F049 brought `overview()` — the one method the console shell
 * needs, because the shell's guard *is* that request — and **F044 the KYC
 * review**, which brings `AuditService` with it.
 *
 * The dealer status machine arrives with **F045**. Everything after that
 * belongs to tiers 8 and 11.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface AdminDeps {
  prisma: PrismaClient;
  audit: AuditService;
  config: PlatformConfigService;
}

/** The three documents KYC needs. A dealership is verified when all three are. */
const REQUIRED_DOCUMENTS = 3;

export function createAdminService({ prisma, audit, config }: AdminDeps) {
  /**
   * The permission check lives here rather than in the router, in the same
   * function that performs the action — so it cannot be bypassed by a second
   * caller reaching the service another way, and it stays next to the audit row
   * it justifies.
   */
  function assertPermission(admin: AdminPrincipal, permission: string): void {
    if (!admin.permissions.includes(permission)) {
      throw new ForbiddenError(`This action needs the ${permission} permission.`);
    }
  }

  return {
    /**
     * D1. The console landing page, and the shell's authorization check in one
     * request: every admin page sits under a layout that awaits this, so a 401
     * here is what redirects to sign-in.
     */
    async overview(admin: AdminPrincipal): Promise<AdminOverview> {
      const [totalDealers, pendingDealers] = await Promise.all([
        prisma.dealer.count(),
        prisma.dealer.count({ where: { status: 'PENDING_APPROVAL' } }),
      ]);

      /*
       * ── Reconstruction slice ──────────────────────────────────────────────
       * The baseline resolves five more counters in the same `Promise.all`:
       * approved and pending-review `Listing`s and the oldest of them
       * (**F064**), captured `Payment` totals (**F052**) and NEW `Enquiry`
       * count (**F088**). None of those models exists yet.
       *
       * With no rows to count, zero is the true answer rather than a
       * placeholder — but it is not the baseline's code, and each query is
       * restored with its model. The GST split below is kept because it is the
       * part that is easy to get wrong later: `payments30d` is gross captured
       * and `revenue30d` is net of GST, and reporting one as the other is the
       * kind of mistake that reaches a board deck.
       * ──────────────────────────────────────────────────────────────────────
       */
      const activeListings = 0;
      const newEnquiries = 0;
      const pending = 0;
      const gross = 0;

      const gstPercent = await config.number('billing.gstPercent');
      const net = Math.round(gross / (1 + gstPercent / 100));

      return {
        stats: [
          {
            key: 'totalDealers',
            label: 'Total dealers',
            value: totalDealers,
            valueLabel: String(totalDealers),
          },
          {
            key: 'pendingVerification',
            label: 'Pending verification',
            value: pendingDealers,
            valueLabel: String(pendingDealers),
            href: '/admin/dealers?status=PENDING_APPROVAL',
          },
          {
            key: 'activeListings',
            label: 'Active listings',
            value: activeListings,
            valueLabel: String(activeListings),
          },
          {
            key: 'payments30d',
            label: 'Payments (30d)',
            value: gross,
            valueLabel: compactRupees(gross),
          },
          { key: 'revenue30d', label: 'Revenue (30d)', value: net, valueLabel: compactRupees(net) },
          {
            key: 'newEnquiries',
            label: 'New enquiries',
            value: newEnquiries,
            valueLabel: String(newEnquiries),
          },
        ],
        moderationQueue: {
          pendingCount: pending,
          oldestWaitingLabel: '—',
          message: 'No listings are waiting for review.',
          href: '/admin/listings',
        },
        headerBadge: {
          count: pending,
          label: `${pending} awaiting review`,
          tone: pending > 0 ? 'warn' : 'neutral',
        },
        operator: { email: admin.email, adminRole: admin.adminRole },
      };
    },

    // ─────────── D5 KYC review ────────────────────────────────────────────

    async verifyDocument(
      admin: AdminPrincipal,
      documentId: string,
    ): Promise<VerifyDocumentResponse> {
      assertPermission(admin, 'admin:document:review');
      return this.reviewDocument(admin, documentId, 'VERIFIED', null);
    },

    async rejectDocument(
      admin: AdminPrincipal,
      documentId: string,
      reason: string,
    ): Promise<VerifyDocumentResponse> {
      assertPermission(admin, 'admin:document:review');
      return this.reviewDocument(admin, documentId, 'REJECTED', reason);
    },

    async reviewDocument(
      admin: AdminPrincipal,
      documentId: string,
      status: 'VERIFIED' | 'REJECTED',
      reason: string | null,
    ): Promise<VerifyDocumentResponse> {
      return withTransaction(prisma, async (tx) => {
        const doc = await tx.dealerDocument.findUnique({ where: { id: documentId } });
        if (!doc) throw new NotFoundError('That document does not exist.');

        await tx.dealerDocument.update({
          where: { id: documentId },
          data: {
            status,
            rejectionReason: reason,
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
          },
        });

        const all = await tx.dealerDocument.findMany({ where: { dealerId: doc.dealerId } });
        const allVerified =
          all.length === REQUIRED_DOCUMENTS && all.every((row) => row.status === 'VERIFIED');

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: doc.dealerId,
          action: status === 'VERIFIED' ? 'document.verified' : 'document.rejected',
          entityType: 'DealerDocument',
          entityId: documentId,
          before: { status: doc.status },
          after: { status, reason },
        });

        return { status, allVerified, dealerCanBeApproved: allVerified };
      });
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;

/** ₹1.2 Cr rather than ₹12,00,00,000 — a stat tile has one line to work with. */
function compactRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`;
  return formatRupees(paise);
}
