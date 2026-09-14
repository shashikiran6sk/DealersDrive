import {
  DEALER_STATUS_LABELS,
  DEALER_STATUS_TONES,
  DOC_TYPE_LABELS,
  PROFILE_CHANGE_STATUS_LABELS,
  PROFILE_CHANGE_STATUS_TONES,
  distinctServices,
  formatDate,
  formatPhone,
  formatRupees,
  initialsOf,
  timeAgo,
  type AdminAccessEntry,
  type AdminAccessResponse,
  type AdminDealerDetail,
  type AdminDealerFacets,
  type AdminDealerQuery,
  type AdminDealersResponse,
  type AdminOverview,
  type AdminProfileChange,
  type AdminProfileChangesResponse,
  type ApproveDealerInput,
  type ConfigResponse,
  type GrantAdminAccessInput,
  type DealerModerationResponse,
  type DealerProfile,
  type DealerPurgeResponse,
  type ProfileChangeDecisionResponse,
  type ProfileChangeStatus,
  type UpdateDealerInput,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { getContext } from '../../middleware/request-context.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import {
  CONFIG_READERS,
  type ConfigDefinition,
  type PlatformConfigService,
} from '../../platform/config/platform-config.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { decodeCursor, encodeCursor } from '../../platform/pagination.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import {
  grantSeat,
  isAllowlistedAdmin,
  setSeatStatus,
  type AdminPrincipal,
} from '../auth/auth.facade.js';
import { documentKey, type DealersService } from '../dealers/dealers.facade.js';
import { DOCUMENT_NOT_FOUND } from '../../platform/messages.js';
import { DEALER_NOT_FOUND } from './admin.messages.js';

export interface AdminDeps {
  prisma: PrismaClient;
  audit: AuditService;
  config: PlatformConfigService;
  storage: StoragePort;
  dealers: DealersService;
}

const REQUIRED_DOCUMENTS = 3;

function toAdminProfileChange(
  row: {
    id: string;
    dealerId: string;
    status: ProfileChangeStatus;
    tagline: string | null;
    specialities: string[];
    createdAt: Date;
    decisionReason: string | null;
  },
  dealer: { slug: string; brandName: string; tagline: string | null; specialities: string[] },
  now: Date = new Date(),
): AdminProfileChange {
  return {
    id: row.id,
    dealerId: row.dealerId,
    dealerSlug: dealer.slug,
    dealerName: dealer.brandName,
    initials: initialsOf(dealer.brandName),
    status: row.status,
    statusLabel: PROFILE_CHANGE_STATUS_LABELS[row.status],
    statusTone: PROFILE_CHANGE_STATUS_TONES[row.status],
    tagline: row.tagline,
    specialities: row.specialities,
    liveTagline: dealer.tagline,
    liveSpecialities: distinctServices(dealer.specialities),
    submittedAt: row.createdAt.toISOString(),
    submittedAtLabel: formatDate(row.createdAt),
    waitingLabel: timeAgo(row.createdAt, now),
    decisionReason: row.decisionReason,
  };
}

export function createAdminService({ prisma, audit, config, storage, dealers }: AdminDeps) {
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

  function assertPermission(admin: AdminPrincipal, permission: string): void {
    if (!admin.permissions.includes(permission)) {
      throw new ForbiddenError(`This action needs the ${permission} permission.`);
    }
  }

  async function requirePendingChange(changeId: string) {
    const change = await prisma.dealerProfileChange.findUnique({
      where: { id: changeId },
      include: { dealer: true },
    });
    if (!change) throw new NotFoundError('That profile edit does not exist.');
    if (change.status !== 'PENDING') {
      throw new ConflictError(
        'PROFILE_CHANGE_DECIDED',
        `This edit has already been ${change.status === 'APPROVED' ? 'published' : 'refused'}.`,
      );
    }
    return change;
  }

  return {
    async overview(admin: AdminPrincipal): Promise<AdminOverview> {
      const [totalDealers, pendingDealers] = await Promise.all([
        prisma.dealer.count(),
        prisma.dealer.count({ where: { status: 'PENDING_APPROVAL' } }),
      ]);

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

    async dealers(query: AdminDealerQuery): Promise<AdminDealersResponse> {
      const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.city ? { city: { equals: query.city, mode: 'insensitive' as const } } : {}),
        ...(query.district
          ? { district: { equals: query.district, mode: 'insensitive' as const } }
          : {}),
        ...(query.state ? { state: { equals: query.state, mode: 'insensitive' as const } } : {}),
        ...(query.q ? { brandName: { contains: query.q, mode: 'insensitive' as const } } : {}),
        ...(query.pendingEdits === 'true'
          ? { profileEdits: { some: { status: 'PENDING' as const } } }
          : {}),
      };

      const rows = await prisma.dealer.findMany({
        where: {
          ...where,
          ...(query.cursor ? { createdAt: { lt: decodeCursor(query.cursor) } } : {}),
        },
        include: {
          documents: true,
          profileEdits: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];

      const activeByDealer = new Map<string, number>();

      const grouped = await prisma.dealer.groupBy({ by: ['status'], _count: { _all: true } });

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
          hasPendingProfileEdit: dealer.profileEdits.length > 0,
        })),
        page: { nextCursor: hasMore && last ? encodeCursor(last.createdAt) : null, hasMore },
        counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])),
        facets,
      };
    },

    async dealerDetail(admin: AdminPrincipal, dealerId: string): Promise<AdminDealerDetail> {
      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        include: {
          documents: { orderBy: { type: 'asc' } },
          members: { include: { user: true }, where: { role: 'OWNER' } },
          profileEdits: { where: { status: 'PENDING' }, take: 1 },
        },
      });
      if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);

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
              ? await storage.signedReadUrl(documentKey(dealer.slug, doc.type, doc.id), 300)
              : null,
            viewUrlExpiresAt: readable ? new Date(Date.now() + 300_000).toISOString() : null,
            rejectionReason: doc.rejectionReason,
          };
        }),
      );

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
        tagline: dealer.tagline,
        specialities: distinctServices(dealer.specialities),
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
        profileChange: dealer.profileEdits[0]
          ? toAdminProfileChange(dealer.profileEdits[0], dealer)
          : null,
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
          canApprove: dealer.status === 'PENDING_APPROVAL' && allVerified,
          canReject: dealer.status === 'PENDING_APPROVAL' || dealer.status === 'DRAFT',
          canRequestChanges: dealer.status === 'PENDING_APPROVAL',
          canSuspend: dealer.status === 'ACTIVE',
          canReinstate: dealer.status === 'SUSPENDED',
          canGrantCredits: admin.permissions.includes('admin:credit:grant'),
          canEdit: admin.permissions.includes('admin:dealer:approve'),
        },
      };
    },

    async approveDealer(
      admin: AdminPrincipal,
      dealerId: string,
      _input: ApproveDealerInput,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
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
    ): Promise<DealerPurgeResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      const dealer = await prisma.dealer.findUnique({
        where: { id: dealerId },
        include: {
          documents: true,
          members: {
            where: { role: 'OWNER', status: 'ACTIVE' },
            take: 1,
            select: { user: { select: { email: true, fullName: true } } },
          },
        },
      });
      if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
      if (dealer.status === 'ACTIVE' || dealer.status === 'SUSPENDED') {
        throw new DomainError(
          'DEALER_ALREADY_APPROVED',
          'An approved dealership is suspended, not rejected. Suspension is reversible; this is not.',
        );
      }

      const media = await prisma.media.findMany({ where: { dealerId } });
      const keys = [
        ...dealer.documents.map((doc) => documentKey(dealer.slug, doc.type, doc.id)),
        ...media.map((row) => row.storageKey),
      ];

      const removals = await Promise.allSettled(keys.map((key) => storage.delete(key)));
      const objectsDeleted = removals.filter((result) => result.status === 'fulfilled').length;

      const purgedAt = new Date();
      await withTransaction(prisma, async (tx) => {
        const owner = dealer.members[0]?.user;
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
            recipientEmail: owner?.email ?? dealer.contactEmail,
            recipientName: owner?.fullName ?? null,
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
          payload: { dealerId, reason },
        });

        await tx.media.deleteMany({ where: { dealerId } });
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

    async requestChanges(
      admin: AdminPrincipal,
      dealerId: string,
      reason: string,
    ): Promise<DealerModerationResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
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

    async updateDealer(
      admin: AdminPrincipal,
      dealerId: string,
      input: UpdateDealerInput,
    ): Promise<DealerProfile> {
      assertPermission(admin, 'admin:dealer:approve');

      const before = await prisma.dealer.findUnique({ where: { id: dealerId } });
      if (!before) throw new NotFoundError(DEALER_NOT_FOUND);

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
        after: input,
      });

      return profile;
    },

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
      status: 'ACTIVE' | 'SUSPENDED',
      reason: string | null,
      action: string,
    ): Promise<DealerModerationResponse> {
      return withTransaction(prisma, async (tx) => {
        const dealer = await tx.dealer.findUnique({
          where: { id: dealerId },
          include: {
            members: {
              where: { status: 'ACTIVE' },
              select: { userId: true },
            },
          },
        });
        if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);

        const memberUserIds = [...new Set(dealer.members.map((member) => member.userId))];

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

        const listings = 0;

        if (memberUserIds.length > 0) {
          await setSeatStatus(tx, {
            userIds: memberUserIds,
            role: 'DEALER',
            status: status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
            reason,
          });

          if (status === 'SUSPENDED') {
            await tx.session.updateMany({
              where: { userId: { in: memberUserIds }, scope: 'DEALER', revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
        }

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
          payload: {
            dealerId,
            ...(status === 'SUSPENDED' ? { reason } : {}),
          },
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
      const rejecting = status === 'REJECTED';

      const outcome = await withTransaction(prisma, async (tx) => {
        const doc = await tx.dealerDocument.findUnique({ where: { id: documentId } });
        if (!doc) throw new NotFoundError(DOCUMENT_NOT_FOUND);

        await tx.dealerDocument.update({
          where: { id: documentId },
          data: {
            status,
            rejectionReason: reason,
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            ...(rejecting ? { fileName: null, mediaId: null } : {}),
          },
        });

        const all = await tx.dealerDocument.findMany({ where: { dealerId: doc.dealerId } });
        const allVerified =
          all.length === REQUIRED_DOCUMENTS && all.every((row) => row.status === 'VERIFIED');

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
          key: dealer ? documentKey(dealer.slug, doc.type, doc.id) : null,
          allVerified,
          dealerReturnedToDraft: returnToDraft,
        };
      });

      if (rejecting && outcome.key) await storage.delete(outcome.key);

      return {
        status,
        allVerified: outcome.allVerified,
        dealerCanBeApproved: outcome.allVerified,
        dealerReturnedToDraft: outcome.dealerReturnedToDraft,
      };
    },

    async profileChanges(admin: AdminPrincipal): Promise<AdminProfileChangesResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      const rows = await prisma.dealerProfileChange.findMany({
        where: { status: 'PENDING' },
        include: { dealer: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      const now = new Date();

      return {
        data: rows.map((row) => toAdminProfileChange(row, row.dealer, now)),
        pendingCount: rows.length,
      };
    },

    async approveProfileChange(
      admin: AdminPrincipal,
      changeId: string,
    ): Promise<ProfileChangeDecisionResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      const change = await requirePendingChange(changeId);

      await dealers.update(change.dealerId, {
        ...(change.tagline === null ? {} : { tagline: change.tagline }),
        ...(change.specialities.length === 0 ? {} : { specialities: change.specialities }),
      });

      const decided = await withTransaction(prisma, async (tx) => {
        const saved = await tx.dealerProfileChange.update({
          where: { id: changeId },
          data: { status: 'APPROVED', reviewedBy: admin.userId, reviewedAt: new Date() },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: change.dealerId,
          action: 'dealer.profile_change.approved',
          entityType: 'DealerProfileChange',
          entityId: changeId,
          before: {
            tagline: change.dealer.tagline,
            specialities: change.dealer.specialities,
          },
          after: { tagline: change.tagline, specialities: change.specialities },
        });

        await enqueueOutbox(tx, {
          type: 'DealerProfileChangeDecided',
          aggregateType: 'Dealer',
          aggregateId: change.dealerId,
          dealerId: change.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'profile-change-approve',
          payload: { changeId, dealerId: change.dealerId, published: true },
        });

        return saved;
      });

      return {
        id: decided.id,
        status: decided.status,
        statusLabel: PROFILE_CHANGE_STATUS_LABELS[decided.status],
        dealerId: change.dealerId,
        dealerSlug: change.dealer.slug,
        published: true,
        decidedAt: (decided.reviewedAt ?? new Date()).toISOString(),
      };
    },

    async rejectProfileChange(
      admin: AdminPrincipal,
      changeId: string,
      reason: string,
    ): Promise<ProfileChangeDecisionResponse> {
      assertPermission(admin, 'admin:dealer:approve');

      const change = await requirePendingChange(changeId);

      const decided = await withTransaction(prisma, async (tx) => {
        const saved = await tx.dealerProfileChange.update({
          where: { id: changeId },
          data: {
            status: 'REJECTED',
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            decisionReason: reason,
          },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: change.dealerId,
          action: 'dealer.profile_change.rejected',
          entityType: 'DealerProfileChange',
          entityId: changeId,
          before: { tagline: change.tagline, specialities: change.specialities },
          after: { status: 'REJECTED', reason },
        });

        await enqueueOutbox(tx, {
          type: 'DealerProfileChangeDecided',
          aggregateType: 'Dealer',
          aggregateId: change.dealerId,
          dealerId: change.dealerId,
          actor: { type: 'ADMIN', id: admin.userId },
          traceId: getContext()?.traceId ?? 'profile-change-reject',
          payload: { changeId, dealerId: change.dealerId, published: false, reason },
        });

        return saved;
      });

      return {
        id: decided.id,
        status: decided.status,
        statusLabel: PROFILE_CHANGE_STATUS_LABELS[decided.status],
        dealerId: change.dealerId,
        dealerSlug: change.dealer.slug,
        published: false,
        decidedAt: (decided.reviewedAt ?? new Date()).toISOString(),
      };
    },

    async config(admin: AdminPrincipal): Promise<ConfigResponse> {
      assertPermission(admin, 'admin:config:write');
      return { data: (await config.all()).map(configEntry) };
    },

    async setConfig(admin: AdminPrincipal, key: string, value: unknown): Promise<ConfigResponse> {
      assertPermission(admin, 'admin:config:write');

      const before = (await config.all()).find((entry) => entry.key === key);
      if (!before) throw new NotFoundError('That configuration key does not exist.');

      if (!matchesDeclaredType(before.type, value)) {
        throw new DomainError(
          'CONFIG_TYPE_MISMATCH',
          `${key} is a ${before.type}, and this value is not one.`,
        );
      }

      await config.set(key, value, admin.userId);

      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: admin.userId,
        action: 'config.updated',
        entityType: 'PlatformConfig',
        entityId: key,
        before: { value: before.value },
        after: { value },
      });

      return { data: (await config.all()).map(configEntry) };
    },

    async adminAccess(admin: AdminPrincipal): Promise<AdminAccessResponse> {
      assertPermission(admin, 'admin:access:manage');

      const users = await prisma.user.findMany({
        where: {
          OR: [{ isPlatformAdmin: true }, { roles: { some: { role: 'ADMIN' } } }],
        },
        include: { roles: { where: { role: 'ADMIN' } } },
        orderBy: { email: 'asc' },
      });

      const granterIds = [
        ...new Set(
          users
            .map((user) => user.roles[0]?.grantedBy)
            .filter((id): id is string => typeof id === 'string'),
        ),
      ];
      const granters = granterIds.length
        ? await prisma.user.findMany({
            where: { id: { in: granterIds } },
            select: { id: true, email: true },
          })
        : [];
      const granterEmail = new Map(granters.map((row) => [row.id, row.email]));

      const seen = new Set<string>();
      const data: AdminAccessEntry[] = [];

      for (const user of users) {
        const email = (user.email ?? '').toLowerCase();
        const seat = user.roles[0];
        const allowlisted = isAllowlistedAdmin(user.email);
        const granted = seat?.status === 'ACTIVE' && seat.grantedBy !== null;

        if (!allowlisted && !granted) continue;

        if (email) seen.add(email);

        data.push({
          userId: user.id,
          email: user.email ?? '',
          fullName: user.fullName,
          adminRole: user.adminRole ?? 'SUPPORT',
          source: allowlisted ? 'ALLOWLIST' : 'GRANT',
          sourceLabel: allowlisted ? 'Allow-listed' : 'Granted',
          grantedByEmail: seat?.grantedBy ? (granterEmail.get(seat.grantedBy) ?? null) : null,
          grantedAt: granted && seat ? seat.grantedAt.toISOString() : null,
          lastLoginLabel: user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never',
          canRevoke: !allowlisted && granted && user.id !== admin.userId,
          revokeBlockedReason: allowlisted
            ? 'Set in ADMIN_ALLOWLIST'
            : user.id === admin.userId
              ? 'This is you'
              : null,
        });
      }

      for (const email of env.adminAllowlist) {
        if (seen.has(email)) continue;
        data.push({
          userId: null,
          email,
          fullName: null,
          adminRole: 'SUPER_ADMIN',
          source: 'ALLOWLIST',
          sourceLabel: 'Allow-listed',
          grantedByEmail: null,
          grantedAt: null,
          lastLoginLabel: 'Never',
          canRevoke: false,
          revokeBlockedReason: 'Set in ADMIN_ALLOWLIST',
        });
      }

      data.sort((a, b) => a.email.localeCompare(b.email));

      return { data, currentUserId: admin.userId };
    },

    async grantAdminAccess(
      admin: AdminPrincipal,
      input: GrantAdminAccessInput,
    ): Promise<AdminAccessEntry> {
      assertPermission(admin, 'admin:access:manage');

      const email = input.email;

      return withTransaction(prisma, async (tx) => {
        const existing = await tx.user.findUnique({ where: { email } });
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: { isPlatformAdmin: true, adminRole: input.adminRole },
            })
          : await tx.user.create({
              data: { email, isPlatformAdmin: true, adminRole: input.adminRole },
            });

        const seat = await grantSeat(tx, {
          userId: user.id,
          role: 'ADMIN',
          grantedBy: admin.userId,
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin.access.granted',
          entityType: 'User',
          entityId: user.id,
          after: { email, adminRole: input.adminRole },
        });

        return {
          userId: user.id,
          email,
          fullName: user.fullName,
          adminRole: input.adminRole,
          source: 'GRANT' as const,
          sourceLabel: 'Granted',
          grantedByEmail: admin.email,
          grantedAt: seat.grantedAt.toISOString(),
          lastLoginLabel: user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never',
          canRevoke: user.id !== admin.userId,
          revokeBlockedReason: user.id === admin.userId ? 'This is you' : null,
        };
      });
    },

    async revokeAdminAccess(admin: AdminPrincipal, userId: string): Promise<void> {
      assertPermission(admin, 'admin:access:manage');

      if (userId === admin.userId) {
        throw new ForbiddenError('You cannot withdraw your own admin access.', {
          code: 'ADMIN_ACCESS_SELF',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { where: { role: 'ADMIN' } } },
      });
      if (!user) throw new NotFoundError('That operator does not exist.');

      if (isAllowlistedAdmin(user.email)) {
        throw new ConflictError(
          'ADMIN_ACCESS_ALLOWLISTED',
          'That address is on ADMIN_ALLOWLIST. Remove it from the deployment to withdraw access.',
        );
      }

      const seat = user.roles[0];
      if (!seat || seat.grantedBy === null) {
        throw new NotFoundError('That operator does not hold a granted seat.');
      }

      await withTransaction(prisma, async (tx) => {
        await tx.userRole.delete({ where: { id: seat.id } });
        await tx.user.update({
          where: { id: user.id },
          data: { isPlatformAdmin: false, adminRole: null },
        });
        await tx.session.updateMany({
          where: { userId: user.id, scope: 'ADMIN', revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          action: 'admin.access.revoked',
          entityType: 'User',
          entityId: user.id,
          before: { email: user.email, adminRole: user.adminRole },
        });
      });
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;

function configEntry(entry: ConfigDefinition): ConfigResponse['data'][number] {
  return {
    key: entry.key,
    value: entry.value,
    type: entry.type,
    label: entry.label,
    updatedAt: null,
    readBy: CONFIG_READERS[entry.key] ?? null,
  };
}

function matchesDeclaredType(type: ConfigDefinition['type'], value: unknown): boolean {
  switch (type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string[]':
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    case 'string':
      return typeof value === 'string';
  }
}

function compactRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`;
  return formatRupees(paise);
}
