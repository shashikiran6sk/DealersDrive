import {
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  DOC_TYPE_LABELS,
  formatDate,
  formatPhone,
  formatRupees,
  initialsOf,
  type AdminDealerDetail,
  type AdminDealerQuery,
  type AdminDealersResponse,
  type AdminOverview,
  type ApproveDealerInput,
  type DealerModerationResponse,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
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
 * **F045 brings the dealer status machine** — the list, the detail screen and
 * the four decisions. Everything after that belongs to tiers 8 and 11.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface AdminDeps {
  prisma: PrismaClient;
  audit: AuditService;
  config: PlatformConfigService;
  storage: StoragePort;
}

/** The three documents KYC needs. A dealership is verified when all three are. */
const REQUIRED_DOCUMENTS = 3;

export function createAdminService({ prisma, audit, config, storage }: AdminDeps) {
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

    // ─────────── D2–D4 dealers ────────────────────────────────────────────

    /**
     * D2. Every dealership, filterable and cursor-paginated. `counts` carries a
     * total per status so the status tabs do not need a second request.
     */
    async dealers(query: AdminDealerQuery): Promise<AdminDealersResponse> {
      const rows = await prisma.dealer.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.city ? { city: { slug: query.city } } : {}),
          ...(query.q ? { brandName: { contains: query.q, mode: 'insensitive' } } : {}),
          ...(query.cursor ? { createdAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        include: {
          city: true,
          documents: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      /*
       * ── Reconstruction slice ──────────────────────────────────────────────
       * The baseline pulls `_count: { vehicles: true }` into the same query and
       * groups `Listing` by dealer for the APPROVED count. Neither model exists
       * before **F055** and **F064**, so both columns read zero here — the true
       * answer while there are no rows, and restored with the models rather
       * than approximated now. Everything else on the row is the baseline's.
       * ──────────────────────────────────────────────────────────────────────
       */
      const activeByDealer = new Map<string, number>();

      const grouped = await prisma.dealer.groupBy({ by: ['status'], _count: { _all: true } });

      return {
        data: page.map((dealer) => ({
          id: dealer.id,
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: initialsOf(dealer.brandName),
          city: dealer.city?.name ?? '—',
          status: dealer.status,
          statusLabel: DEALER_STATUS_LABELS[dealer.status],
          statusTone: DEALER_STATUS_TONES[dealer.status],
          vehicleCount: 0,
          activeCount: activeByDealer.get(dealer.id) ?? 0,
          joinedAt: dealer.createdAt.toISOString(),
          joinedLabel: formatDate(dealer.createdAt),
          creditBalance: dealer.creditBalance,
          documentsVerified:
            dealer.documents.length === REQUIRED_DOCUMENTS &&
            dealer.documents.every((doc) => doc.status === 'VERIFIED'),
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
        counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
      };
    },

    /**
     * D3. One dealership with everything a decision needs on a single screen —
     * including an `actions` block, so the console never re-derives the state
     * machine and two admins cannot reach different conclusions about the same
     * dealership.
     */
    async dealerDetail(admin: AdminPrincipal, dealerId: string): Promise<AdminDealerDetail> {
      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        include: {
          city: true,
          documents: { orderBy: { type: 'asc' } },
          members: { include: { user: true }, where: { role: 'OWNER' } },
        },
      });
      if (!dealer) throw new NotFoundError('That dealership does not exist.');

      /*
       * ── Reconstruction slice ──────────────────────────────────────────────
       * The baseline resolves four more numbers here: `_count` of `Vehicle`
       * (**F055**) and `Enquiry` (**F088**), APPROVED and PENDING_REVIEW
       * `Listing` counts (**F064**), and the last eight `CreditTransaction`
       * rows (**F050**). The screen renders all four, so they stay in the
       * response shape and read empty until the models exist.
       * ──────────────────────────────────────────────────────────────────────
       */
      const active = 0;
      const pending = 0;
      const ledger: {
        id: string;
        delta: number;
        label: string;
        createdAt: Date;
        balanceAfter: number;
      }[] = [];

      const owner = dealer.members[0];
      const allVerified =
        dealer.documents.length === REQUIRED_DOCUMENTS &&
        dealer.documents.every((d) => d.status === 'VERIFIED');

      // Every signed document URL issued is audit-logged with the admin's
      // identity — that is the whole access control on KYC media (§26.6).
      const documents = await Promise.all(
        dealer.documents.map(async (doc) => {
          const readable = doc.status === 'UPLOADED' || doc.status === 'VERIFIED';
          return {
            id: doc.id,
            type: doc.type,
            label: DOC_TYPE_LABELS[doc.type],
            status: doc.status,
            fileName: doc.fileName,
            bytes: null,
            uploadedAt: doc.createdAt.toISOString(),
            viewUrl: readable
              ? await storage.signedReadUrl(`kyc/${dealerId}/${doc.type}/${doc.id}`, 300)
              : null,
            viewUrlExpiresAt: readable ? new Date(Date.now() + 300_000).toISOString() : null,
            rejectionReason: doc.rejectionReason,
          };
        }),
      );

      if (documents.some((doc) => doc.viewUrl)) {
        await audit.recordDetached({
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.documents.viewed',
          entityType: 'Dealer',
          entityId: dealerId,
        });
      }

      return {
        id: dealer.id,
        slug: dealer.slug,
        brandName: dealer.brandName,
        legalName: dealer.legalName,
        initials: initialsOf(dealer.brandName),
        status: dealer.status,
        statusLabel: DEALER_STATUS_LABELS[dealer.status],
        statusTone: DEALER_STATUS_TONES[dealer.status],
        statusReason: dealer.statusReason,
        gstin: dealer.gstin,
        pan: dealer.pan,
        city: dealer.city?.name ?? null,
        addressLine: dealer.addressLine,
        contactName: owner?.user.fullName ?? null,
        contactPhone: dealer.contactPhone,
        contactPhoneDisplay: dealer.contactPhone ? formatPhone(dealer.contactPhone) : null,
        contactEmail: owner?.user.email ?? dealer.contactEmail,
        joinedLabel: formatDate(dealer.createdAt),
        creditBalance: dealer.creditBalance,
        creditsHeld: dealer.creditsHeld,
        counts: {
          vehicles: 0,
          active,
          pending,
          enquiries: 0,
        },
        documents,
        allDocumentsVerified: allVerified,
        recentLedger: ledger.map((row) => ({
          id: row.id,
          delta: row.delta,
          deltaLabel: row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? '0' : `−${-row.delta}`,
          label: row.label,
          dateLabel: formatDate(row.createdAt),
          balanceAfter: row.balanceAfter,
        })),
        actions: {
          canApprove: dealer.status === 'PENDING_APPROVAL' && allVerified,
          canReject: dealer.status === 'PENDING_APPROVAL',
          canSuspend: dealer.status === 'ACTIVE',
          canReinstate: dealer.status === 'SUSPENDED',
          canGrantCredits: admin.permissions.includes('admin:credit:grant'),
        },
      };
    },

    /**
     * D4. ACTIVE is what makes a dealership's listings eligible to appear
     * publicly at all (rule 6), so this is the single most consequential write
     * in the console.
     *
     * ── Reconstruction slice ────────────────────────────────────────────────
     * The baseline seeds an onboarding bonus here when `grantCredits` is given,
     * through `moveCredits`. Rule 4 says every credit movement writes a
     * `CreditTransaction`, and neither the model nor `billing.facade.ts` exists
     * until **F050** — so the field is absent from `ApproveDealerInput`, which
     * is `.strict()` and therefore names it in a 400 rather than accepting it
     * and quietly moving nothing. `creditsGranted` stays in the response and
     * reads zero; the grant returns with the ledger that can honour it.
     * ────────────────────────────────────────────────────────────────────────
     */
    async approveDealer(
      admin: AdminPrincipal,
      dealerId: string,
      _input: ApproveDealerInput,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) throw new NotFoundError('That dealership does not exist.');
        if (dealer.status === 'ACTIVE') {
          throw new DomainError('ALREADY_ACTIVE', 'That dealership is already active.');
        }

        const updated = await tx.dealer.update({
          where: { id: dealerId },
          data: { status: 'ACTIVE', approvedAt: new Date(), statusReason: null },
        });

        const creditsGranted = 0;

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.approved',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.status },
          after: { status: 'ACTIVE', creditsGranted },
        });

        await enqueueOutbox(tx, {
          type: 'DealerApproved',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'dealer-approve',
          payload: { dealerId },
        });

        return {
          id: updated.id,
          status: updated.status,
          statusLabel: DEALER_STATUS_LABELS[updated.status],
          creditsGranted,
          creditBalance: updated.creditBalance,
          listingsAffected: 0,
          notifiedAt: new Date().toISOString(),
        };
      });
    },

    async rejectDealer(
      admin: AdminPrincipal,
      dealerId: string,
      reason: string,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');
      return this.setDealerStatus(admin, dealerId, 'REJECTED', reason, 'dealer.rejected');
    },

    /** Suspension pulls every listing out of the catalogue immediately (D4). */
    async suspendDealer(
      admin: AdminPrincipal,
      dealerId: string,
      reason: string,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');
      return this.setDealerStatus(admin, dealerId, 'SUSPENDED', reason, 'dealer.suspended');
    },

    async reinstateDealer(
      admin: AdminPrincipal,
      dealerId: string,
      note?: string,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');
      return this.setDealerStatus(admin, dealerId, 'ACTIVE', note ?? null, 'dealer.reinstated');
    },

    async setDealerStatus(
      admin: AdminPrincipal,
      dealerId: string,
      status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED',
      reason: string | null,
      action: string,
    ): Promise<DealerModerationResponse> {
      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) throw new NotFoundError('That dealership does not exist.');

        const updated = await tx.dealer.update({
          where: { id: dealerId },
          data: {
            status,
            statusReason: reason,
            ...(status === 'SUSPENDED' ? { suspendedAt: new Date() } : {}),
            ...(status === 'ACTIVE'
              ? { suspendedAt: null, approvedAt: dealer.approvedAt ?? new Date() }
              : {}),
          },
        });

        // `Listing` arrives with F064; until then no listing can be affected,
        // which is why this reads zero rather than being left out of the shape.
        const listings = 0;

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action,
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.status },
          after: { status, reason },
        });

        await enqueueOutbox(tx, {
          type:
            status === 'SUSPENDED'
              ? 'DealerSuspended'
              : status === 'REJECTED'
                ? 'DealerRejected'
                : 'DealerReinstated',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? action,
          payload: { dealerId },
        });

        return {
          id: updated.id,
          status: updated.status,
          statusLabel: DEALER_STATUS_LABELS[updated.status],
          creditsGranted: 0,
          creditBalance: updated.creditBalance,
          listingsAffected: listings,
          notifiedAt: new Date().toISOString(),
        };
      });
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
