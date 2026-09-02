import {
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  DOC_TYPE_LABELS,
  formatDate,
  formatKm,
  formatLakh,
  formatPhone,
  formatRupees,
  FUEL_LABELS,
  initialsOf,
  ownerLabel,
  PAYMENT_STATUS_LABELS,
  timeAgo,
  TRANSMISSION_LABELS,
  type AdminDealerDetail,
  type AdminDealerQuery,
  type AdminDealersResponse,
  type AdminListingDetail,
  type AdminListingQuery,
  type AdminOverview,
  type AdminPaymentQuery,
  type AdminPaymentsResponse,
  type ApproveDealerInput,
  type ApproveListingResponse,
  type AuditQuery,
  type AuditResponse,
  type ConfigResponse,
  type DealerModerationResponse,
  type GrantCreditsInput,
  type GrantCreditsResponse,
  type ModerationFlag,
  type ModerationQueueResponse,
  type RejectListingResponse,
  type RequestChangesResponse,
  type TakedownInput,
  type TakedownResponse,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { ReportsService } from '../reports/reports.facade.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../platform/errors.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { mediaUrl } from '../../platform/media/urls.js';
import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import { bodyTypeLabel } from '../search/search.facade.js';
import {
  currentBalance,
  moveCredits,
  refreshActiveListings,
  refreshHeldCount,
} from '../billing/billing.facade.js';
import { displayStatus, transition } from '../listings/listings.facade.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';

export interface AdminDeps {
  prisma: PrismaClient;
  audit: AuditService;
  config: PlatformConfigService;
  storage: StoragePort;
  /**
   * The moderator gets the **dealer** projection, not the buyer's summary.
   *
   * A person approving a listing is the last human between a flagged vehicle
   * and the public marketplace. Handing them the same redacted view a buyer
   * gets would be withholding evidence from the one reader whose whole job is
   * to weigh it.
   */
  reports: ReportsService;
}

export function createAdminService({ prisma, audit, config, storage, reports }: AdminDeps) {
  function assertPermission(admin: AdminPrincipal, permission: string): void {
    if (!admin.permissions.includes(permission)) {
      throw new ForbiddenError(`This action needs the ${permission} permission.`);
    }
  }

  return {
    async overview(admin: AdminPrincipal): Promise<AdminOverview> {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

      const [
        totalDealers,
        pendingDealers,
        activeListings,
        payments,
        newEnquiries,
        pending,
        oldest,
      ] = await Promise.all([
        prisma.dealer.count(),
        prisma.dealer.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.listing.count({ where: { status: 'APPROVED' } }),
        prisma.payment.aggregate({
          where: { status: 'CAPTURED', capturedAt: { gte: thirtyDaysAgo } },
          _sum: { amountPaise: true },
        }),
        prisma.enquiry.count({ where: { status: 'NEW' } }),
        prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.listing.findFirst({
          where: { status: 'PENDING_REVIEW' },
          orderBy: { submittedAt: 'asc' },
        }),
      ]);

      const gstPercent = await config.number('billing.gstPercent');
      // Gross captured vs revenue recognised net of GST. Different on purpose.
      const gross = Number(payments._sum.amountPaise ?? 0n);
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
          oldestWaitingLabel: oldest ? timeAgo(oldest.submittedAt).replace(' ago', '') : '—',
          message: pending
            ? `${pending} listing${pending === 1 ? '' : 's'} submitted by dealers ${
                pending === 1 ? 'is' : 'are'
              } waiting for approval.${
                oldest
                  ? ` Oldest has been waiting ${timeAgo(oldest.submittedAt).replace(' ago', '')}.`
                  : ''
              }`
            : 'No listings are waiting for review.',
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

    // ─────────── D2–D6 dealers ────────────────────────────────────────────

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
          _count: { select: { vehicles: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const activeCounts = await prisma.listing.groupBy({
        by: ['dealerId'],
        where: { status: 'APPROVED' },
        _count: { _all: true },
      });
      const activeByDealer = new Map(activeCounts.map((row) => [row.dealerId, row._count._all]));

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
          vehicleCount: dealer._count.vehicles,
          activeCount: activeByDealer.get(dealer.id) ?? 0,
          joinedAt: dealer.createdAt.toISOString(),
          joinedLabel: formatDate(dealer.createdAt),
          creditBalance: dealer.creditBalance,
          documentsVerified:
            dealer.documents.length === 3 &&
            dealer.documents.every((doc) => doc.status === 'VERIFIED'),
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
        counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
      };
    },

    async dealerDetail(admin: AdminPrincipal, dealerId: string): Promise<AdminDealerDetail> {
      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        include: {
          city: true,
          documents: { orderBy: { type: 'asc' } },
          members: { include: { user: true }, where: { role: 'OWNER' } },
          _count: { select: { vehicles: true, enquiries: true } },
        },
      });
      if (!dealer) throw new NotFoundError('That dealership does not exist.');

      const [active, pending, ledger] = await Promise.all([
        prisma.listing.count({ where: { dealerId, status: 'APPROVED' } }),
        prisma.listing.count({ where: { dealerId, status: 'PENDING_REVIEW' } }),
        prisma.creditTransaction.findMany({
          where: { dealerId },
          orderBy: { seq: 'desc' },
          take: 8,
        }),
      ]);

      const owner = dealer.members[0];
      const allVerified =
        dealer.documents.length === 3 && dealer.documents.every((d) => d.status === 'VERIFIED');

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
          vehicles: dealer._count.vehicles,
          active,
          pending,
          enquiries: dealer._count.enquiries,
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

    async approveDealer(
      admin: AdminPrincipal,
      dealerId: string,
      input: ApproveDealerInput,
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

        let creditsGranted = 0;
        let balance = await currentBalance(tx, dealerId);
        if (input.grantCredits && input.grantCredits > 0) {
          const movement = await moveCredits(tx, {
            dealerId,
            delta: input.grantCredits,
            reason: 'ADMIN_GRANT',
            label: input.note ? `Admin grant — ${input.note}` : 'Admin grant — onboarding bonus',
            actorType: 'ADMIN',
            actorId: admin.userId,
          });
          creditsGranted = input.grantCredits;
          balance = movement.balanceAfter;
        }

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
          creditBalance: balance,
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

        const listings = await tx.listing.count({ where: { dealerId, status: 'APPROVED' } });

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
        const allVerified = all.length === 3 && all.every((row) => row.status === 'VERIFIED');

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

    async grantCredits(
      admin: AdminPrincipal,
      dealerId: string,
      input: GrantCreditsInput,
    ): Promise<GrantCreditsResponse> {
      assertPermission(admin, 'admin:credit:grant');

      return withTransaction(prisma, async (tx) => {
        const movement = await moveCredits(tx, {
          dealerId,
          delta: input.credits,
          reason: input.credits > 0 ? 'ADMIN_GRANT' : 'ADMIN_ADJUSTMENT',
          label: input.label,
          actorType: 'ADMIN',
          actorId: admin.userId,
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'credits.granted',
          entityType: 'Dealer',
          entityId: dealerId,
          after: { delta: input.credits, reason: input.reason ?? null },
        });

        return {
          transactionId: movement.transactionId,
          delta: input.credits,
          balanceAfter: movement.balanceAfter,
          dealerNotified: true,
        };
      });
    },

    // ─────────── D7–D12 moderation ────────────────────────────────────────

    async queue(query: AdminListingQuery): Promise<ModerationQueueResponse> {
      const minPhotos = await config.number('listing.minPhotos');

      const rows = await prisma.listing.findMany({
        where: {
          status: query.status,
          ...(query.dealer ? { dealer: { slug: query.dealer } } : {}),
          ...(query.city ? { vehicle: { city: { slug: query.city } } } : {}),
          ...(query.cursor ? { submittedAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        include: {
          dealer: true,
          vehicle: {
            include: {
              make: true,
              model: true,
              variant: true,
              city: true,
              media: { include: { media: true }, orderBy: { position: 'asc' } },
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const [pendingCount, oldest] = await Promise.all([
        prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.listing.findFirst({
          where: { status: 'PENDING_REVIEW' },
          orderBy: { submittedAt: 'asc' },
        }),
      ]);

      return {
        data: page.map((listing) => {
          const vehicle = listing.vehicle;
          const photos = vehicle.media.filter((m) => m.media.status === 'READY');
          const primary =
            vehicle.media.find((m) => m.media.id === vehicle.primaryMediaId) ?? vehicle.media[0];

          return {
            listingId: listing.id,
            vehicleId: vehicle.id,
            title: [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
              .filter(Boolean)
              .join(' '),
            thumbnailUrl: primary ? mediaUrl(primary.media.id, 320) : null,
            dealer: {
              slug: listing.dealer.slug,
              brandName: listing.dealer.brandName,
              isVerified: listing.dealer.status === 'ACTIVE',
            },
            pricePaise: Number(vehicle.pricePaise ?? 0n),
            priceLabel: vehicle.pricePaise ? formatLakh(vehicle.pricePaise) : '—',
            city: vehicle.city?.name ?? '—',
            kmLabel: vehicle.kmDriven === null ? '—' : formatKm(vehicle.kmDriven),
            fuelLabel: FUEL_LABELS[vehicle.fuel],
            transmissionLabel: TRANSMISSION_LABELS[vehicle.transmission],
            photoCount: photos.length,
            submittedAt: listing.submittedAt.toISOString(),
            submittedLabel: timeAgo(listing.submittedAt),
            flags: flagsFor(
              {
                photoCount: photos.length,
                description: vehicle.description,
                km: vehicle.kmDriven,
                year: vehicle.year,
              },
              minPhotos,
            ),
          };
        }),
        page: { nextCursor: hasMore && last ? encodeCursor(last.submittedAt) : null, hasMore },
        pendingCount,
        oldestWaitingLabel: oldest ? timeAgo(oldest.submittedAt).replace(' ago', '') : '—',
      };
    },

    async listingDetail(listingId: string): Promise<AdminListingDetail> {
      const [listing, minPhotos, presets, durationDays] = await Promise.all([
        prisma.listing.findUnique({
          where: { id: listingId },
          include: {
            dealer: true,
            vehicle: {
              include: {
                make: true,
                model: true,
                variant: true,
                color: true,
                city: true,
                media: { include: { media: true }, orderBy: { position: 'asc' } },
              },
            },
          },
        }),
        config.number('listing.minPhotos'),
        config.stringList('listing.rejectionReasonPresets'),
        config.number('listing.durationDays'),
      ]);

      if (!listing) throw new NotFoundError('That listing does not exist.');

      const vehicle = listing.vehicle;
      const photos = vehicle.media.filter((m) => m.media.status === 'READY');
      const title = [vehicle.year, vehicle.make.name, vehicle.model.name, vehicle.variant?.name]
        .filter(Boolean)
        .join(' ');
      const status = displayStatus(vehicle, listing);
      const report = await reports.latestDto(vehicle.id);

      return {
        listingId: listing.id,
        vehicleId: vehicle.id,
        report,
        /**
         * A listing reaching review at all, while its report says
         * BLACKLISTED, means someone overrode the submission blocker. The
         * override is audit-logged either way; this flag is what puts it on
         * the screen, where the next moderator will actually see it.
         */
        blacklistOverridden: report?.blacklistStatus === 'BLACKLISTED',
        status: listing.status,
        displayStatus: status,
        title,
        priceLabel: vehicle.pricePaise ? formatLakh(vehicle.pricePaise) : '—',
        metaLabel: [
          vehicle.pricePaise ? formatLakh(vehicle.pricePaise) : '—',
          vehicle.city?.name ?? '—',
          listing.dealer.brandName,
        ].join(' · '),
        dealer: {
          id: listing.dealer.id,
          slug: listing.dealer.slug,
          brandName: listing.dealer.brandName,
          status: listing.dealer.status,
          isVerified: listing.dealer.status === 'ACTIVE',
          creditBalance: listing.dealer.creditBalance,
          href: `/admin/dealers/${listing.dealer.id}`,
        },
        photos: photos.map((entry, index) => ({
          id: entry.media.id,
          position: entry.position,
          label:
            entry.media.fileName?.replace(/\.[a-z]+$/, '').replace(/-/g, ' ') ??
            `Photo ${index + 1}`,
          url: mediaUrl(entry.media.id, 1600),
        })),
        photoCount: photos.length,
        photoCountLabel: `${photos.length} submitted photo${photos.length === 1 ? '' : 's'}`,
        specs: [
          {
            key: 'km',
            label: 'KM driven',
            value: vehicle.kmDriven === null ? '—' : formatKm(vehicle.kmDriven),
          },
          { key: 'fuel', label: 'Fuel', value: FUEL_LABELS[vehicle.fuel] },
          {
            key: 'transmission',
            label: 'Transmission',
            value: TRANSMISSION_LABELS[vehicle.transmission],
          },
          { key: 'owners', label: 'Ownership', value: ownerLabel(vehicle.ownerNumber ?? 1) },
          { key: 'bodyType', label: 'Body type', value: bodyTypeLabel(vehicle.bodyType) },
          { key: 'photos', label: 'Photos submitted', value: String(photos.length) },
          {
            key: 'dealerStatus',
            label: 'Dealer status',
            value:
              listing.dealer.status === 'ACTIVE'
                ? `Verified${listing.dealer.gstin ? ' · GSTIN on file' : ''}`
                : DEALER_STATUS_LABELS[listing.dealer.status],
          },
        ],
        description: vehicle.description,
        flags: flagsFor(
          {
            photoCount: photos.length,
            description: vehicle.description,
            km: vehicle.kmDriven,
            year: vehicle.year,
          },
          minPhotos,
        ),
        credit: {
          held: listing.creditHeld,
          transactionId: listing.creditTxnId,
          dealerBalance: listing.dealer.creditBalance,
        },
        actions: {
          canApprove: listing.status === 'PENDING_REVIEW',
          canReject: listing.status === 'PENDING_REVIEW',
          canRequestChanges: listing.status === 'PENDING_REVIEW',
          canTakedown: ['APPROVED', 'PENDING_REVIEW', 'CHANGES_REQUESTED'].includes(listing.status),
          consequenceNote: `Approving publishes this listing to the public catalogue for ${durationDays} days and spends one of the dealer's credits. This cannot be undone.`,
        },
        rejectionReasonPresets: presets,
      };
    },

    /**
     * D9. The hold settles: `CONSUME_APPROVE` with **delta 0**, and still a row,
     * because the dealer needs to see "Listing published — …" in their history
     * on the day it happened, at the balance it happened at (§26.3).
     */
    async approveListing(
      admin: AdminPrincipal,
      listingId: string,
    ): Promise<ApproveListingResponse> {
      assertPermission(admin, 'admin:listing:moderate');
      const durationDays = await config.number('listing.durationDays');

      const result = await withTransaction(prisma, async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
          include: {
            dealer: true,
            vehicle: { include: { make: true, model: true, variant: true } },
          },
        });
        if (!listing) throw new NotFoundError('That listing does not exist.');

        const next = transition(listing, 'APPROVE', 'ADMIN');
        const approvedAt = new Date();
        const expiresAt = new Date(approvedAt.getTime() + durationDays * 86_400_000);

        const title = [
          listing.vehicle.year,
          listing.vehicle.make.name,
          listing.vehicle.model.name,
          listing.vehicle.variant?.name,
        ]
          .filter(Boolean)
          .join(' ');

        const movement = await moveCredits(tx, {
          dealerId: listing.dealerId,
          delta: 0,
          reason: 'CONSUME_APPROVE',
          label: `Listing published — ${title}`,
          listingId,
          actorType: 'ADMIN',
          actorId: admin.userId,
        });

        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: next,
            approvedAt,
            expiresAt,
            reviewedAt: approvedAt,
            reviewedBy: admin.userId,
            creditHeld: false,
            rejectionReason: null,
            changeRequestNote: null,
          },
        });

        await refreshHeldCount(tx, listing.dealerId);
        await refreshActiveListings(tx, listing.dealerId);

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'listing.approved',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: listing.status },
          after: { status: next, expiresAt: expiresAt.toISOString() },
        });

        // Indexing, revalidation and the dealer email are all asynchronous and
        // none of them can roll back the approval (§10).
        await enqueueOutbox(tx, {
          type: 'ListingApproved',
          aggregateType: 'Listing',
          aggregateId: listingId,
          dealerId: listing.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'approve',
          payload: { listingId, vehicleId: listing.vehicleId },
        });

        return { listing, movement, approvedAt, expiresAt, slug: listing.vehicle.slug };
      });

      return {
        listingId,
        status: 'APPROVED',
        displayStatus: 'ACTIVE',
        approvedAt: result.approvedAt.toISOString(),
        expiresAt: result.expiresAt.toISOString(),
        expiryLabel: formatDate(result.expiresAt),
        credit: {
          consumed: 1,
          transactionId: result.movement.transactionId,
          dealerBalanceAfter: result.movement.balanceAfter,
        },
        publicUrl: `${env.WEB_BASE_URL}/car/${result.slug ?? ''}`,
        toast: 'Listing approved — now live in the public catalogue.',
      };
    },

    /** D10. Rejection releases the credit; the reason is stored verbatim. */
    async rejectListing(
      admin: AdminPrincipal,
      listingId: string,
      reason: string,
    ): Promise<RejectListingResponse> {
      assertPermission(admin, 'admin:listing:moderate');

      const result = await withTransaction(prisma, async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
          include: { vehicle: { include: { make: true, model: true, variant: true } } },
        });
        if (!listing) throw new NotFoundError('That listing does not exist.');

        const next = transition(listing, 'REJECT', 'ADMIN');
        const title = [
          listing.vehicle.year,
          listing.vehicle.make.name,
          listing.vehicle.model.name,
          listing.vehicle.variant?.name,
        ]
          .filter(Boolean)
          .join(' ');

        const movement = listing.creditHeld
          ? await moveCredits(tx, {
              dealerId: listing.dealerId,
              delta: 1,
              reason: 'RELEASE_REJECT',
              label: `Credit returned — ${title}`,
              listingId,
              actorType: 'ADMIN',
              actorId: admin.userId,
            })
          : null;

        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: next,
            rejectionReason: reason,
            reviewedAt: new Date(),
            reviewedBy: admin.userId,
            creditHeld: false,
          },
        });

        await refreshHeldCount(tx, listing.dealerId);

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'listing.rejected',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: listing.status },
          after: { status: next, reason },
        });

        await enqueueOutbox(tx, {
          type: 'ListingRejected',
          aggregateType: 'Listing',
          aggregateId: listingId,
          dealerId: listing.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'reject',
          payload: { listingId, reason },
        });

        const balance = movement?.balanceAfter ?? (await currentBalance(tx, listing.dealerId));
        return { movement, balance };
      });

      return {
        listingId,
        status: 'REJECTED',
        displayStatus: 'REJECTED',
        reason,
        credit: {
          released: result.movement ? 1 : 0,
          transactionId: result.movement?.transactionId ?? null,
          dealerBalanceAfter: result.balance,
        },
        dealerNotifiedAt: new Date().toISOString(),
        toast: 'Listing rejected — the dealer has been notified with your reason.',
      };
    },

    /** D11. The credit stays held. That is the difference from rejection. */
    async requestChanges(
      admin: AdminPrincipal,
      listingId: string,
      note: string,
    ): Promise<RequestChangesResponse> {
      assertPermission(admin, 'admin:listing:moderate');

      const balance = await withTransaction(prisma, async (tx) => {
        const listing = await tx.listing.findUnique({ where: { id: listingId } });
        if (!listing) throw new NotFoundError('That listing does not exist.');

        const next = transition(listing, 'REQUEST_CHANGES', 'ADMIN');

        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: next,
            changeRequestNote: note,
            reviewedAt: new Date(),
            reviewedBy: admin.userId,
          },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'listing.changes_requested',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: listing.status },
          after: { status: next, note },
        });

        await enqueueOutbox(tx, {
          type: 'ListingChangesRequested',
          aggregateType: 'Listing',
          aggregateId: listingId,
          dealerId: listing.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'request-changes',
          payload: { listingId, note },
        });

        return currentBalance(tx, listing.dealerId);
      });

      return {
        listingId,
        status: 'CHANGES_REQUESTED',
        displayStatus: 'CHANGES_REQUESTED',
        note,
        credit: { stillHeld: 1, dealerBalanceAfter: balance },
        dealerNotifiedAt: new Date().toISOString(),
        toast: 'Changes requested — the dealer can edit and resubmit.',
      };
    },

    async takedown(
      admin: AdminPrincipal,
      listingId: string,
      input: TakedownInput,
    ): Promise<TakedownResponse> {
      assertPermission(admin, 'admin:listing:moderate');

      await withTransaction(prisma, async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
          include: { vehicle: { include: { make: true, model: true } } },
        });
        if (!listing) throw new NotFoundError('That listing does not exist.');

        const next = transition(listing, 'TAKEDOWN', 'ADMIN');

        if (input.refundCredit) {
          await moveCredits(tx, {
            dealerId: listing.dealerId,
            delta: 1,
            reason: 'REVERSAL',
            label: `Credit refunded — ${listing.vehicle.make.name} ${listing.vehicle.model.name} taken down`,
            listingId,
            actorType: 'ADMIN',
            actorId: admin.userId,
          });
        }

        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: next,
            removedAt: new Date(),
            rejectionReason: input.reason,
            creditHeld: false,
          },
        });

        await refreshHeldCount(tx, listing.dealerId);
        await refreshActiveListings(tx, listing.dealerId);

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: listing.dealerId,
          action: 'listing.takedown',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: listing.status },
          after: { status: next, reason: input.reason },
        });

        await enqueueOutbox(tx, {
          type: 'ListingRemoved',
          aggregateType: 'Listing',
          aggregateId: listingId,
          dealerId: listing.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'takedown',
          payload: { listingId },
        });
      });

      return {
        status: 'REMOVED',
        removedFromCatalogueAt: new Date().toISOString(),
        creditRefunded: input.refundCredit,
      };
    },

    // ─────────── D13–D15 payments, config, audit ──────────────────────────

    async payments(
      admin: AdminPrincipal,
      query: AdminPaymentQuery,
    ): Promise<AdminPaymentsResponse> {
      assertPermission(admin, 'admin:payment:read');

      const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86_400_000);
      const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();

      const rows = await prisma.payment.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.dealer ? { dealer: { slug: query.dealer } } : {}),
          createdAt: { gte: from, lte: to },
          ...(query.cursor ? { createdAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        include: { dealer: true, order: true, invoices: true },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const [captured, gstPercent] = await Promise.all([
        prisma.payment.aggregate({
          where: { status: 'CAPTURED', capturedAt: { gte: from, lte: to } },
          _sum: { amountPaise: true },
          _count: { _all: true },
        }),
        config.number('billing.gstPercent'),
      ]);

      const gross = Number(captured._sum.amountPaise ?? 0n);
      const net = Math.round(gross / (1 + gstPercent / 100));

      return {
        data: page.map((payment) => ({
          id: payment.id,
          gatewayPaymentId: payment.gatewayPaymentId,
          dealer: { slug: payment.dealer.slug, brandName: payment.dealer.brandName },
          invoiceNumber: payment.invoices[0]?.number ?? null,
          credits: payment.order.credits,
          amountPaise: Number(payment.amountPaise),
          amountLabel: formatRupees(payment.amountPaise),
          method: payment.method,
          status: payment.status,
          statusLabel: PAYMENT_STATUS_LABELS[payment.status],
          statusTone:
            payment.status === 'CAPTURED' ? 'ok' : payment.status === 'FAILED' ? 'err' : 'neutral',
          capturedAt: payment.capturedAt?.toISOString() ?? null,
          dateLabel: formatDate(payment.capturedAt ?? payment.createdAt),
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
        totals: {
          grossPaise: gross,
          grossLabel: compactRupees(gross),
          netPaise: net,
          netLabel: compactRupees(net),
          taxPaise: gross - net,
          taxLabel: formatRupees(gross - net),
          count: captured._count._all,
          periodLabel: query.from ? `${query.from} to ${query.to ?? 'today'}` : 'Last 30 days',
        },
      };
    },

    async config(): Promise<ConfigResponse> {
      const entries = await config.all();
      return {
        data: entries.map((entry) => ({
          key: entry.key,
          value: entry.value,
          type: entry.type,
          label: entry.label,
          updatedAt: null,
        })),
      };
    },

    async setConfig(admin: AdminPrincipal, key: string, value: unknown) {
      assertPermission(admin, 'admin:config:write');
      const before = (await config.all()).find((entry) => entry.key === key);
      if (!before) throw new NotFoundError('That configuration key does not exist.');

      const updated = await config.set(key, value, admin.userId);

      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: admin.userId,
        action: 'config.updated',
        entityType: 'PlatformConfig',
        entityId: key,
        before: { value: before.value },
        after: { value },
      });

      return {
        key,
        value: updated.value,
        previousValue: before.value,
        updatedBy: admin.userId,
        updatedAt: new Date().toISOString(),
      };
    },

    async auditLogs(admin: AdminPrincipal, query: AuditQuery): Promise<AuditResponse> {
      assertPermission(admin, 'admin:audit:read');

      const rows = await prisma.auditLog.findMany({
        where: {
          ...(query.entityType ? { entityType: query.entityType } : {}),
          ...(query.entityId ? { entityId: query.entityId } : {}),
          ...(query.dealerId ? { dealerId: query.dealerId } : {}),
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(query.action ? { action: query.action } : {}),
          ...(query.cursor ? { createdAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const actorIds = [
        ...new Set(page.map((row) => row.actorId).filter((id): id is string => id !== null)),
      ];
      const actors = actorIds.length
        ? await prisma.user.findMany({ where: { id: { in: actorIds } } })
        : [];
      const actorById = new Map(actors.map((user) => [user.id, user]));

      return {
        data: page.map((row) => ({
          id: String(row.id),
          actorType: row.actorType,
          actor: {
            id: row.actorId,
            email: row.actorId ? (actorById.get(row.actorId)?.email ?? null) : null,
          },
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          dealerId: row.dealerId,
          before: row.before,
          after: row.after,
          ip: row.ip,
          traceId: row.traceId,
          createdAt: row.createdAt.toISOString(),
          dateLabel: formatDate(row.createdAt),
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
      };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;

/** Advisory only, never auto-rejecting (§10). */
function flagsFor(
  input: { photoCount: number; description: string | null; km: number | null; year: number },
  minPhotos: number,
): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  if (input.photoCount < minPhotos) {
    flags.push({
      code: 'TOO_FEW_PHOTOS',
      severity: 'warn',
      message: `Only ${input.photoCount} photos; ${minPhotos} is the minimum.`,
    });
  }

  if (input.description && /(\+?\d[\d\s-]{8,})|https?:\/\//i.test(input.description)) {
    flags.push({
      code: 'CONTACT_IN_DESCRIPTION',
      severity: 'warn',
      message: 'The description appears to contain a phone number or a link.',
    });
  }

  const age = Math.max(1, new Date().getUTCFullYear() - input.year);
  if (input.km !== null && input.km / age > 40_000) {
    flags.push({
      code: 'IMPLAUSIBLE_KM',
      severity: 'warn',
      message: `${Math.round(input.km / age).toLocaleString('en-IN')} km per year is unusually high.`,
    });
  }

  return flags;
}

/** "₹4.2 L" — the admin stat boxes' compact form. */
function compactRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`;
  return formatRupees(paise);
}
