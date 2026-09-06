import {
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  DOC_TYPE_LABELS,
  formatDate,
  formatPhone,
  formatRupees,
  initialsOf,
  type AdminDealerDetail,
  type AdminDealerFacets,
  type AdminDealerQuery,
  type AdminDealersResponse,
  type AdminOverview,
  type ApproveDealerInput,
  type DealerModerationResponse,
  type DealerProfile,
  type DealerPurgeResponse,
  type UpdateDealerInput,
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
import { documentKey, type DealersService } from '../dealers/dealers.facade.js';

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
  /**
   * The dealer service, for the one write the console makes into a dealership's
   * own data (D3 edit).
   *
   * It is taken as a dependency rather than reimplemented because everything
   * that makes `PATCH /v1/dealer` correct has to hold for the admin path too:
   * locality normalisation, the E.164 rewrite that the phone's unique index is
   * an index *over*, the name-within-a-city duplicate check, and writing
   * `brandName` from `legalName` so the display mirror cannot drift. A second
   * copy of that would be a second set of rules, and the two would disagree.
   */
  dealers: DealersService;
}

/** The three documents KYC needs. A dealership is verified when all three are. */
const REQUIRED_DOCUMENTS = 3;

export function createAdminService({ prisma, audit, config, storage, dealers }: AdminDeps) {
  /**
   * Every location a dealership actually sits in, for the console's filters.
   *
   * `distinct` on the column rather than a table of places, because there is no
   * table of places any more — D1 removed it, and the values here were typed by
   * dealers and normalised on write. Nulls are dropped and the result is sorted
   * so the select reads alphabetically.
   */
  async function locationFacets(): Promise<AdminDealerFacets> {
    const [cities, districts, states] = await Promise.all([
      prisma.dealer.findMany({
        distinct: ['city'],
        where: { city: { not: null } },
        select: { city: true },
        orderBy: { city: 'asc' },
      }),
      prisma.dealer.findMany({
        distinct: ['district'],
        where: { district: { not: null } },
        select: { district: true },
        orderBy: { district: 'asc' },
      }),
      prisma.dealer.findMany({
        distinct: ['state'],
        where: { state: { not: null } },
        select: { state: true },
        orderBy: { state: 'asc' },
      }),
    ]);

    const named = (value: string | null): value is string => Boolean(value);

    return {
      cities: cities.map((row) => row.city).filter(named),
      districts: districts.map((row) => row.district).filter(named),
      states: states.map((row) => row.state).filter(named),
    };
  }

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
      /**
       * The three location filters, `AND`ed.
       *
       * Each is the dealership's own text now rather than a slug on a joined
       * row, and each is matched case-insensitively — a filter built from one
       * dealership's `Vellore` still finds another's `vellore`. Combining them
       * is what makes the console usable at scale: a state narrows to a few
       * hundred, a district to a few dozen, a town to the one being asked
       * about.
       */
      const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.city ? { city: { equals: query.city, mode: 'insensitive' as const } } : {}),
        ...(query.district
          ? { district: { equals: query.district, mode: 'insensitive' as const } }
          : {}),
        ...(query.state ? { state: { equals: query.state, mode: 'insensitive' as const } } : {}),
        ...(query.q ? { brandName: { contains: query.q, mode: 'insensitive' as const } } : {}),
      };

      const rows = await prisma.dealer.findMany({
        where: {
          ...where,
          ...(query.cursor ? { createdAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        include: { documents: true },
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

      /*
       * The filter's own options, read off the rows rather than kept in a list
       * somewhere. Three cheap `DISTINCT`s: the whole table is the domain of
       * the filter, so they are deliberately *not* narrowed by `where` —
       * picking a state must not empty the district select and strand the
       * console with no way back.
       */
      const facets = await locationFacets();

      return {
        data: page.map((dealer) => ({
          id: dealer.id,
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: initialsOf(dealer.brandName),
          city: dealer.city ?? '—',
          district: dealer.district ?? '—',
          state: dealer.state ?? '—',
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
        facets,
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
              ? await storage.signedReadUrl(documentKey(dealerId, doc.type, doc.id), 300)
              : null,
            viewUrlExpiresAt: readable ? new Date(Date.now() + 300_000).toISOString() : null,
            rejectionReason: doc.rejectionReason,
          };
        }),
      );

      /**
       * The yard photograph, signed the same way a document is.
       *
       * A moderator has to be able to see it. "Is this a clear photograph of
       * the premises, or is it a screenshot of a logo" is the question the
       * requirement exists to ask, and it is not one the API can answer.
       */
      const yardPhoto = dealer.coverMediaId
        ? await prisma.media.findUnique({ where: { id: dealer.coverMediaId } })
        : null;
      const yardPhotoUrl =
        yardPhoto && yardPhoto.status !== 'ORPHAN'
          ? await storage.signedReadUrl(yardPhoto.storageKey, 300)
          : null;

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
        city: dealer.city,
        district: dealer.district,
        state: dealer.state,
        addressLine: dealer.addressLine,
        pincode: dealer.pincode,
        mapsUrl: dealer.mapsUrl,
        contactName: owner?.user.fullName ?? null,
        contactPhone: dealer.contactPhone,
        contactPhoneDisplay: dealer.contactPhone ? formatPhone(dealer.contactPhone) : null,
        contactEmail: owner?.user.email ?? dealer.contactEmail,
        landline: dealer.landline,
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
        yardPhotoUrl,
        recentLedger: ledger.map((row) => ({
          id: row.id,
          delta: row.delta,
          deltaLabel: row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? '0' : `−${-row.delta}`,
          label: row.label,
          dateLabel: formatDate(row.createdAt),
          balanceAfter: row.balanceAfter,
        })),
        actions: {
          /*
           * Approval needs both: an application waiting, and the documents
           * behind it verified. The console renders the control whenever the
           * first is true and disables it on the second — `allDocumentsVerified`
           * is on this response, so it can say *why* rather than showing
           * nothing at all. A screen with no button on it reads as a broken
           * screen, and that is how this was being reported.
           */
          canApprove: dealer.status === 'PENDING_APPROVAL' && allVerified,
          /*
           * Rejection destroys the application (see `rejectDealer`), so it is
           * offered only while there is nothing behind the dealership to
           * destroy — before it has ever been approved. An ACTIVE dealership
           * that has gone bad is suspended, which is reversible; a SUSPENDED
           * one has already been dealt with.
           */
          canReject: dealer.status === 'PENDING_APPROVAL' || dealer.status === 'DRAFT',
          /*
           * Sending it back is available from exactly the state where the
           * dealer cannot otherwise act: PENDING_APPROVAL shows them the "we
           * are reviewing this" panel and no form. From DRAFT they can already
           * edit everything, so there is nothing to reopen.
           */
          canRequestChanges: dealer.status === 'PENDING_APPROVAL',
          canSuspend: dealer.status === 'ACTIVE',
          canReinstate: dealer.status === 'SUSPENDED',
          canGrantCredits: admin.permissions.includes('admin:credit:grant'),
          canEdit: admin.permissions.includes('admin:dealer:approve'),
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

    /**
     * D4 reject — and it is a **purge**, not a status change.
     *
     * A rejection says "this is not a dealership we will trade with", and the
     * product's answer to that is to keep nothing: the three KYC scans and the
     * yard photograph are deleted from object storage, and the `dealers` row
     * goes with them — taking its documents and its OWNER membership by
     * cascade. The person keeps their verified Google account and nothing else,
     * so signing in again finds no membership and drops them at step one of
     * onboarding as a first-time applicant.
     *
     * **This is the destructive answer, and it is the rarer one.** A moderator
     * who wants a clearer GST certificate, or the legal name spelt as it is on
     * the PAN card, wants `requestChanges` below — which keeps every field the
     * dealer typed and merely reopens the form. Rejecting instead would cost a
     * real business its whole application over a blurry photograph, and the two
     * controls are separated in the console for that reason.
     *
     * Three things make the destruction safe to reason about:
     *
     *   · **The audit row outlives the dealership.** `audit_logs.dealerId` is a
     *     column, not a foreign key, so the record of who rejected what, when
     *     and why survives the row it refers to. It is written before the
     *     delete for the same reason.
     *   · **Storage is emptied before the rows are.** The row is the only thing
     *     that knows where the bytes are — a KYC scan's key ends in its
     *     document id. Delete the row first and the scan of somebody's PAN card
     *     stays in the bucket with nothing left pointing at it, which is a
     *     retention problem rather than a housekeeping one.
     *   · **Only an unapproved application can be rejected.** `canReject` is
     *     DRAFT or PENDING_APPROVAL, so there is never a listing, a payment or
     *     a buyer's enquiry hanging off the row being removed. An ACTIVE
     *     dealership that goes bad is *suspended*, which is reversible.
     */
    async rejectDealer(
      admin: AdminPrincipal,
      dealerId: string,
      reason: string,
    ): Promise<DealerPurgeResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        include: { documents: true },
      });
      if (!dealer) throw new NotFoundError('That dealership does not exist.');
      if (dealer.status === 'ACTIVE' || dealer.status === 'SUSPENDED') {
        throw new DomainError(
          'DEALER_ALREADY_APPROVED',
          'An approved dealership is suspended, not rejected. Suspension is reversible; this is not.',
        );
      }

      /*
       * Every object this dealership put in the bucket: the KYC scans, whose
       * keys are derived from the document rows, and the media rows — the yard
       * photograph, and a logo if one was ever uploaded — which carry their own
       * `storageKey`.
       */
      const media = await prisma.media.findMany({ where: { dealerId } });
      const keys = [
        ...dealer.documents.map((doc) => documentKey(dealerId, doc.type, doc.id)),
        ...media.map((row) => row.storageKey),
      ];

      /*
       * `allSettled`, and the count is of what actually went.
       *
       * A key that is already gone — a document row whose upload never
       * completed — must not abort the purge and leave the dealership
       * half-destroyed. What matters is that the rows are removed; an object
       * left behind is reconcilable from the audit row, and a `dealers` row
       * left behind is a dealership the applicant can still sign into.
       */
      const removals = await Promise.allSettled(keys.map((key) => storage.delete(key)));
      const objectsDeleted = removals.filter((result) => result.status === 'fulfilled').length;

      const purgedAt = new Date();
      await withTransaction(prisma, async (tx) => {
        // Written first, and with the whole record in `before`, because in a
        // moment there will be nothing left to describe it.
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.rejected',
          entityType: 'Dealer',
          entityId: dealerId,
          before: {
            status: dealer.status,
            slug: dealer.slug,
            brandName: dealer.brandName,
            legalName: dealer.legalName,
            gstin: dealer.gstin,
            pan: dealer.pan,
            city: dealer.city,
            district: dealer.district,
            state: dealer.state,
            contactEmail: dealer.contactEmail,
            documents: dealer.documents.map((doc) => ({ type: doc.type, status: doc.status })),
          },
          after: { purged: true, reason, objectsDeleted },
        });

        await enqueueOutbox(tx, {
          type: 'DealerRejected',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'dealer-reject',
          /*
           * Ids and the reason, and no PII — the same rule every other payload
           * follows, and it holds here even though the handler cannot re-fetch
           * the dealership afterwards. The outbox is a durable table that
           * outlives the row it describes; putting an applicant's name and
           * email into it is exactly the thing a rejection is supposed to
           * remove. The `before` block on the audit row above is where a
           * notification handler reads what it needs.
           */
          payload: { dealerId, reason },
        });

        await tx.media.deleteMany({ where: { dealerId } });
        // `dealer_documents` and `dealer_members` are `onDelete: Cascade`.
        await tx.dealer.delete({ where: { id: dealerId } });
      });

      return {
        id: dealerId,
        brandName: dealer.brandName,
        documentsDeleted: dealer.documents.length,
        objectsDeleted,
        reason,
        purgedAt: purgedAt.toISOString(),
      };
    },

    /**
     * D4 request changes — the reversible refusal, and the one a moderator
     * reaches for far more often than rejection.
     *
     * PENDING_APPROVAL → DRAFT with the reason attached. Nothing is deleted:
     * every field the dealer typed, every document they uploaded and the yard
     * photograph all stay exactly where they are. What changes is that the
     * application is *theirs* again — the onboarding screen stops showing the
     * "we are reviewing this" panel and reopens the form, filled in, with the
     * reason at the top of it.
     *
     * The status is the only mechanism that can do this. A dealership is
     * blocked from editing while PENDING_APPROVAL precisely so that a moderator
     * is not reviewing a moving target; handing it back means giving up that
     * guarantee, deliberately, and taking the application out of the queue at
     * the same time.
     */
    async requestChanges(
      admin: AdminPrincipal,
      dealerId: string,
      reason: string,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) throw new NotFoundError('That dealership does not exist.');
        if (dealer.status !== 'PENDING_APPROVAL') {
          throw new DomainError(
            'NOT_UNDER_REVIEW',
            'Only an application waiting for a decision can be sent back.',
          );
        }

        const updated = await tx.dealer.update({
          where: { id: dealerId },
          data: { status: 'DRAFT', statusReason: reason },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.changes_requested',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: dealer.status },
          after: { status: 'DRAFT', reason },
        });

        await enqueueOutbox(tx, {
          type: 'DealerChangesRequested',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'dealer-request-changes',
          payload: { dealerId, reason },
        });

        return {
          id: updated.id,
          status: updated.status,
          statusLabel: DEALER_STATUS_LABELS[updated.status],
          creditsGranted: 0,
          creditBalance: updated.creditBalance,
          listingsAffected: 0,
          notifiedAt: new Date().toISOString(),
        };
      });
    },

    /**
     * D3 edit — the console amending a dealership's own answers.
     *
     * A moderator reading a GSTIN off a certificate can see that the dealer
     * typed one digit wrong, and the alternative to fixing it here is a round
     * trip that costs a working day to correct a character. So the console can
     * write the same fields the dealer can.
     *
     * It goes through `dealers.update` rather than touching `prisma.dealer`
     * directly, and that is the whole design: locality normalisation, the
     * E.164 rewrite, the name-unique-within-a-city check and the `brandName`
     * mirror are all rules about the *data*, not about who is editing it. An
     * admin path with its own copy of them would be an admin path that drifts.
     *
     * The audit row is what the dealer path does not have, and is the reason
     * this is not simply the same endpoint: an edit a dealer did not make must
     * be attributable to the person who made it.
     */
    async updateDealer(
      admin: AdminPrincipal,
      dealerId: string,
      input: UpdateDealerInput,
    ): Promise<DealerProfile> {
      assertPermission(admin, 'admin:dealer:approve');

      const before = await prisma.dealer.findUnique({ where: { id: dealerId } });
      if (!before) throw new NotFoundError('That dealership does not exist.');

      const profile = await dealers.update(dealerId, input);

      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: admin.userId,
        dealerId,
        action: 'dealer.updated',
        entityType: 'Dealer',
        entityId: dealerId,
        before: {
          legalName: before.legalName,
          gstin: before.gstin,
          pan: before.pan,
          addressLine: before.addressLine,
          city: before.city,
          district: before.district,
          state: before.state,
          pincode: before.pincode,
          mapsUrl: before.mapsUrl,
          contactPhone: before.contactPhone,
          contactEmail: before.contactEmail,
          landline: before.landline,
        },
        // The fields the admin actually sent, rather than the whole row after
        // the write: a diff nobody has to compute is a diff nobody gets wrong.
        after: input,
      });

      return profile;
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

    /**
     * The two reversible moves, in one function: suspend and reinstate.
     *
     * REJECTED is deliberately not reachable here any more. It used to be the
     * third case, and that was what made rejection look like a status change —
     * `rejectDealer` now destroys the application rather than labelling it, and
     * the union below is narrowed so the old path cannot be walked by accident.
     */
    async setDealerStatus(
      admin: AdminPrincipal,
      dealerId: string,
      status: 'ACTIVE' | 'SUSPENDED',
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
          type: status === 'SUSPENDED' ? 'DealerSuspended' : 'DealerReinstated',
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

    /**
     * D5 reject — "send me this one again", not "you are not a dealership".
     *
     * This is the narrowest of the three refusals in the console and the
     * distinction is load-bearing, because the word is the same and the
     * consequence is not. Rejecting a *document* rejects a file: the scan is
     * unreadable, or it is last year's electricity bill, or it is a photograph
     * of the wrong page. The other two documents are untouched, the dealership
     * is untouched, and the only thing being asked for is one upload.
     *
     * Two things follow from that, and both are done in `reviewDocument`:
     *
     *   · **The file is deleted from storage.** Keeping a rejected scan of
     *     somebody's PAN card serves nothing — it will never be read again,
     *     because the dealer is about to replace it — and KYC media is exactly
     *     the category where "we still had a copy" is the wrong answer. The row
     *     survives, because the checklist is three fixed rows, but it survives
     *     empty: no file name, no media id, no readable object behind it. The
     *     dealer sees the slot they saw before they ever uploaded, with the
     *     reason underneath saying what to send instead.
     *   · **The application is reopened.** A PENDING_APPROVAL dealership is
     *     shown the "we are reviewing this" panel and no form, so a dealer told
     *     to re-upload could not reach the upload box. The rejection therefore
     *     returns the dealership to DRAFT — which is the same thing
     *     `requestChanges` does, because it *is* a request for changes, scoped
     *     to one document.
     */
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
      const rejecting = status === 'REJECTED';

      const outcome = await withTransaction(prisma, async (tx) => {
        const doc = await tx.dealerDocument.findUnique({ where: { id: documentId } });
        if (!doc) throw new NotFoundError('That document does not exist.');

        await tx.dealerDocument.update({
          where: { id: documentId },
          data: {
            status,
            rejectionReason: reason,
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            // A rejected document keeps its row and loses its file. Clearing
            // these two is what makes the dealer's checklist render an empty
            // slot rather than a file name they can no longer open.
            ...(rejecting ? { fileName: null, mediaId: null } : {}),
          },
        });

        const all = await tx.dealerDocument.findMany({ where: { dealerId: doc.dealerId } });
        const allVerified =
          all.length === REQUIRED_DOCUMENTS && all.every((row) => row.status === 'VERIFIED');

        /*
         * Hand the application back so the re-upload is possible at all.
         *
         * Scoped to PENDING_APPROVAL: a DRAFT dealership is already editable,
         * and an ACTIVE one is not in the onboarding flow — a document
         * rejection against a trading dealership is a compliance matter for
         * suspension to answer, not a reason to drop it back into onboarding.
         */
        const dealer = await tx.dealer.findUnique({ where: { id: doc.dealerId } });
        const returnToDraft = rejecting && dealer?.status === 'PENDING_APPROVAL';
        if (returnToDraft) {
          await tx.dealer.update({
            where: { id: doc.dealerId },
            data: {
              status: 'DRAFT',
              statusReason: `${DOC_TYPE_LABELS[doc.type]}: ${reason ?? 'Please upload it again.'}`,
            },
          });

          await enqueueOutbox(tx, {
            type: 'DealerChangesRequested',
            aggregateType: 'Dealer',
            aggregateId: doc.dealerId,
            dealerId: doc.dealerId,
            actor: { type: 'ADMIN', id: admin.userId },
            traceId: getContext()?.traceId ?? 'document-rejected',
            payload: { dealerId: doc.dealerId, documentType: doc.type, reason },
          });
        }

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: doc.dealerId,
          action: status === 'VERIFIED' ? 'document.verified' : 'document.rejected',
          entityType: 'DealerDocument',
          entityId: documentId,
          before: { status: doc.status, fileName: doc.fileName },
          after: { status, reason, fileDeleted: rejecting, dealerReturnedToDraft: returnToDraft },
        });

        return {
          key: documentKey(doc.dealerId, doc.type, doc.id),
          allVerified,
          dealerReturnedToDraft: returnToDraft,
        };
      });

      /*
       * The bytes go after the transaction commits, not inside it.
       *
       * Object storage cannot be rolled back. Deleting first and then failing
       * to commit would leave a row saying UPLOADED with nothing behind it —
       * the one state the dealer cannot recover from, because the checklist
       * would offer "Replace" for a file that is not there. Doing it this way
       * risks the opposite and much cheaper failure: an object nothing points
       * at, which a sweeper reconciles.
       */
      if (rejecting) await storage.delete(outcome.key);

      return {
        status,
        allVerified: outcome.allVerified,
        dealerCanBeApproved: outcome.allVerified,
        dealerReturnedToDraft: outcome.dealerReturnedToDraft,
      };
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
