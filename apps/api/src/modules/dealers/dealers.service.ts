import {
  DEALER_STATUS_LABELS,
  DOC_TYPE_LABELS,
  formatPhone,
  initialsOf,
  timeAgo,
  type CompletenessResponse,
  type DashboardResponse,
  type DealerDocumentsResponse,
  type DealerProfile,
  type DealerSubmitResponse,
  type DocumentCommitInput,
  type DocumentPresignInput,
  type AuthSession,
  type PresignResponse,
  type UpdateDealerInput,
} from '@dealers-drive/contracts';
import type { DealerDocType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { DomainError, NotFoundError } from '../../platform/errors.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { EnquiriesRepository } from '../enquiries/enquiries.facade.js';
import type { DealerPrincipal } from '../auth/auth.facade.js';
import type { DealersRepository, DealerWithRelations } from './dealers.repository.js';

export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
  enquiries: EnquiriesRepository;
  storage: StoragePort;
}

const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];

export function createDealersService({ prisma, repo, enquiries, storage }: DealersDeps) {
  function toProfile(dealer: DealerWithRelations): DealerProfile {
    const owner = dealer.members.find((member) => member.role === 'OWNER');

    return {
      id: dealer.id,
      slug: dealer.slug,
      status: dealer.status,
      statusLabel: dealer.status === 'ACTIVE' ? 'Verified' : DEALER_STATUS_LABELS[dealer.status],
      statusReason: dealer.statusReason,
      brandName: dealer.brandName,
      legalName: dealer.legalName,
      tagline: dealer.tagline,
      about: dealer.about,
      gstin: dealer.gstin,
      pan: dealer.pan,
      contact: {
        fullName: owner?.user.fullName ?? null,
        roleTitle: owner?.user.roleTitle ?? null,
        phone: dealer.contactPhone ?? owner?.user.phone ?? '',
        phoneDisplay: formatPhone(dealer.contactPhone ?? owner?.user.phone ?? ''),
        email: owner?.user.email ?? dealer.contactEmail,
        landline: dealer.landline,
      },
      address: {
        line: dealer.addressLine,
        cityId: dealer.cityId,
        city: dealer.city?.name ?? null,
        state: dealer.city?.state ?? null,
        pincode: dealer.pincode,
      },
      specialities: dealer.specialities,
      workingHours: dealer.workingHours as Record<string, string | null> | null,
      establishedYear: dealer.establishedYear,
      logoMediaId: dealer.logoMediaId,
      coverMediaId: dealer.coverMediaId,
      creditBalance: dealer.creditBalance,
      creditsHeld: dealer.creditsHeld,
      activeListings: dealer.activeListings,
      approvedAt: dealer.approvedAt?.toISOString() ?? null,
      createdAt: dealer.createdAt.toISOString(),
    };
  }

  async function requireDealer(dealerId: string): Promise<DealerWithRelations> {
    const dealer = await repo.findById(dealerId);
    if (!dealer) throw new NotFoundError('That dealership no longer exists.');
    return dealer;
  }

  return {
    toProfile,

    /**
     * The dealer half of B4. `identity` is filled in by the auth module, which
     * owns the OAuth tables — this service knows about dealerships, not about
     * how the person at the keyboard proved who they are.
     */
    async session(principal: DealerPrincipal): Promise<AuthSession> {
      const dealer = await requireDealer(principal.dealerId);
      const owner = dealer.members.find((member) => member.userId === principal.userId);
      const [newEnquiries, pendingListings] = await Promise.all([
        repo.newEnquiryCount(dealer.id),
        repo.pendingListingCount(dealer.id),
      ]);

      const phone = owner?.user.phone ?? dealer.contactPhone ?? '';

      return {
        // A dealership still in DRAFT has not finished onboarding, whatever the
        // client remembers; PENDING_APPROVAL is waiting on a human at our end.
        next:
          dealer.status === 'DRAFT'
            ? 'ONBOARDING'
            : dealer.status === 'PENDING_APPROVAL'
              ? 'PENDING_APPROVAL'
              : 'DASHBOARD',
        identity: null,
        user: {
          id: principal.userId,
          fullName: owner?.user.fullName ?? null,
          roleTitle: owner?.user.roleTitle ?? null,
          phone,
          phoneDisplay: formatPhone(phone),
          email: owner?.user.email ?? null,
          emailVerified: owner?.user.emailVerifiedAt !== null,
        },
        dealer: {
          id: dealer.id,
          slug: dealer.slug,
          brandName: dealer.brandName,
          status: dealer.status,
          statusLabel:
            dealer.status === 'ACTIVE' ? 'Verified' : DEALER_STATUS_LABELS[dealer.status],
          isVerified: dealer.status === 'ACTIVE',
          creditBalance: dealer.creditBalance,
          creditsHeld: dealer.creditsHeld,
        },
        role: principal.role,
        permissions: [...principal.permissions],
        counts: { newEnquiries, pendingListings },
      };
    },

    async profile(dealerId: string): Promise<DealerProfile> {
      return toProfile(await requireDealer(dealerId));
    },

    /** C2. Partial, so a wizard `Back` never loses data. `phone` is not patchable. */
    async update(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');

      const updated = await withTransaction(prisma, async (tx) => {
        if (input.contact && owner) {
          await tx.user.update({
            where: { id: owner.userId },
            data: {
              ...(input.contact.fullName === undefined ? {} : { fullName: input.contact.fullName }),
              ...(input.contact.roleTitle === undefined
                ? {}
                : { roleTitle: input.contact.roleTitle }),
              ...(input.contact.email === undefined ? {} : { email: input.contact.email }),
            },
          });
        }

        return repo.update(
          dealerId,
          {
            ...(input.brandName === undefined ? {} : { brandName: input.brandName }),
            ...(input.legalName === undefined ? {} : { legalName: input.legalName }),
            ...(input.tagline === undefined ? {} : { tagline: input.tagline }),
            ...(input.about === undefined ? {} : { about: input.about }),
            ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
            ...(input.pan === undefined ? {} : { pan: input.pan }),
            ...(input.establishedYear === undefined
              ? {}
              : { establishedYear: input.establishedYear }),
            ...(input.specialities === undefined ? {} : { specialities: input.specialities }),
            ...(input.workingHours === undefined ? {} : { workingHours: input.workingHours }),
            ...(input.contact?.email === undefined ? {} : { contactEmail: input.contact.email }),
            ...(input.contact?.landline === undefined ? {} : { landline: input.contact.landline }),
            ...(input.address?.line === undefined ? {} : { addressLine: input.address.line }),
            ...(input.address?.cityId === undefined ? {} : { cityId: input.address.cityId }),
            ...(input.address?.pincode === undefined ? {} : { pincode: input.address.pincode }),
          },
          tx,
        );
      });

      return toProfile(updated);
    },

    /** C3. Drives the onboarding stepper and gates `POST /v1/dealer/submit`. */
    async completeness(dealerId: string): Promise<CompletenessResponse> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');
      const documents = await repo.documents(dealerId);

      const accountMissing: string[] = [];
      if (!owner?.user.fullName) accountMissing.push('fullName');
      if (!owner?.user.email) accountMissing.push('email');

      const businessMissing: string[] = [];
      if (!dealer.brandName) businessMissing.push('brandName');
      if (!dealer.legalName) businessMissing.push('legalName');
      if (!dealer.addressLine) businessMissing.push('addressLine');
      if (!dealer.cityId) businessMissing.push('cityId');
      if (!dealer.pincode) businessMissing.push('pincode');
      if (!dealer.gstin) businessMissing.push('gstin');
      if (!dealer.pan) businessMissing.push('pan');

      const documentsMissing = DOC_TYPES.filter((type) => {
        const doc = documents.find((row) => row.type === type);
        return !doc || doc.status === 'REQUIRED' || doc.status === 'REJECTED';
      });

      const steps: CompletenessResponse['steps'] = [
        {
          key: 'account',
          label: 'Account',
          complete: accountMissing.length === 0,
          missing: accountMissing,
        },
        {
          key: 'business',
          label: 'Business',
          complete: businessMissing.length === 0,
          missing: businessMissing,
        },
        {
          key: 'documents',
          label: 'Documents',
          complete: documentsMissing.length === 0,
          missing: documentsMissing,
        },
        {
          key: 'review',
          label: 'Review',
          complete: dealer.status !== 'DRAFT',
          missing: [],
        },
      ];

      const done = steps.filter((step) => step.complete).length;
      const isComplete = steps.slice(0, 3).every((step) => step.complete);

      return {
        isComplete,
        canSubmit: isComplete && dealer.status === 'DRAFT',
        percent: Math.round((done / steps.length) * 100),
        steps,
      };
    },

    /** C4. DRAFT → PENDING_APPROVAL. No body; the state machine decides. */
    async submitForVerification(dealerId: string): Promise<DealerSubmitResponse> {
      const dealer = await requireDealer(dealerId);
      if (dealer.status !== 'DRAFT') {
        throw new DomainError(
          'ALREADY_SUBMITTED',
          'This dealership has already been submitted for verification.',
        );
      }

      const state = await this.completeness(dealerId);
      if (!state.isComplete) {
        throw new DomainError('PROFILE_INCOMPLETE', 'Some details are still missing.', {
          errors: state.steps.flatMap((step) =>
            step.missing.map((field) => ({
              field,
              code: 'REQUIRED',
              message: `${field} is required.`,
            })),
          ),
        });
      }

      const submittedAt = new Date();
      await withTransaction(prisma, async (tx) => {
        await repo.update(dealerId, { status: 'PENDING_APPROVAL' }, tx);
        await enqueueOutbox(tx, {
          type: 'DealerApplied',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'DEALER' },
          traceId: getContext()?.traceId ?? 'dealer-submit',
          payload: { dealerId },
        });
      });

      return {
        status: 'PENDING_APPROVAL',
        statusLabel: 'Under review',
        submittedAt: submittedAt.toISOString(),
        expectedDecisionBy: new Date(submittedAt.getTime() + 86_400_000).toISOString(),
        message:
          'We verify GSTIN, PAN and address proof against government records. Most dealerships are approved within one working day.',
      };
    },

    // ─────────── C5 KYC documents ─────────────────────────────────────────

    async documents(dealerId: string): Promise<DealerDocumentsResponse> {
      const rows = await repo.documents(dealerId);

      const data = DOC_TYPES.map((type) => {
        const doc = rows.find((row) => row.type === type);
        const status = doc?.status ?? 'REQUIRED';

        return {
          id: doc?.id ?? null,
          type,
          label: DOC_TYPE_LABELS[type],
          status,
          statusLabel: documentStatusLabel(
            status,
            doc?.fileName ?? null,
            doc?.rejectionReason ?? null,
          ),
          fileName: doc?.fileName ?? null,
          uploadedAt: doc?.createdAt.toISOString() ?? null,
          rejectionReason: doc?.rejectionReason ?? null,
          action:
            status === 'REQUIRED' || status === 'REJECTED'
              ? 'Upload'
              : status === 'UPLOADING'
                ? 'Cancel'
                : 'Replace',
        };
      });

      return { data, allVerified: data.every((doc) => doc.status === 'VERIFIED') };
    },

    /**
     * Documents go through the same presign → PUT → commit pipeline as photos,
     * with three differences: a private prefix, **no public delivery route**,
     * and no derivatives. The promise that buyers never see them is enforced by
     * there being no route that could serve them, not by a flag (§26.6).
     */
    async presignDocument(dealerId: string, input: DocumentPresignInput): Promise<PresignResponse> {
      const documentId = randomUUID();
      const key = `kyc/${dealerId}/${input.type}/${documentId}`;

      await repo.upsertDocument(dealerId, input.type, {
        id: documentId,
        status: 'UPLOADING',
        fileName: input.fileName,
        mediaId: null,
        rejectionReason: null,
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });

      return {
        documentId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
      };
    },

    async commitDocument(dealerId: string, type: DealerDocType, input: DocumentCommitInput) {
      const doc = await repo.documentById(input.documentId);
      if (!doc || doc.dealerId !== dealerId || doc.type !== type) {
        throw new NotFoundError('That document does not exist.');
      }

      const key = `kyc/${dealerId}/${type}/${input.documentId}`;
      const object = await storage.head(key);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }

      await repo.upsertDocument(dealerId, type, { status: 'UPLOADED', mediaId: null });
      const response = await this.documents(dealerId);
      return response.data.find((row) => row.type === type);
    },

    async deleteDocument(dealerId: string, type: DealerDocType): Promise<void> {
      const removed = await repo.deleteDocument(dealerId, type);
      if (!removed) throw new NotFoundError('That document does not exist.');
      await storage.delete(`kyc/${dealerId}/${type}`);
    },

    // ─────────── C18 dashboard ────────────────────────────────────────────

    /**
     * One round trip, everything. `heightPct` is computed here against the
     * week's max so the chart cannot disagree with the numbers beside it.
     */
    async dashboard(dealerId: string): Promise<DashboardResponse> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');

      const weekStart = startOfDayUtc(new Date(Date.now() - 6 * 86_400_000));
      const previousWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);

      const [
        rollups,
        previousRollups,
        newEnquiries,
        previousEnquiries,
        recent,
        expiringSoon,
        usedThisMonth,
        addedThisWeek,
      ] = await Promise.all([
        prisma.listingViewDaily.groupBy({
          by: ['day'],
          where: { dealerId, day: { gte: weekStart } },
          _sum: { views: true },
        }),
        prisma.listingViewDaily.aggregate({
          where: { dealerId, day: { gte: previousWeekStart, lt: weekStart } },
          _sum: { views: true },
        }),
        prisma.enquiry.count({
          where: { dealerId, status: 'NEW', createdAt: { gte: weekStart } },
        }),
        prisma.enquiry.count({
          where: {
            dealerId,
            status: { not: 'SPAM' },
            createdAt: { gte: previousWeekStart, lt: weekStart },
          },
        }),
        enquiries.recentForDealer(dealerId, 4),
        prisma.listing.count({
          where: {
            dealerId,
            status: 'APPROVED',
            expiresAt: { lte: new Date(Date.now() + 7 * 86_400_000) },
          },
        }),
        prisma.creditTransaction.count({
          where: { dealerId, reason: 'HOLD_SUBMIT', createdAt: { gte: startOfMonthUtc() } },
        }),
        prisma.listing.count({
          where: { dealerId, status: 'APPROVED', approvedAt: { gte: weekStart } },
        }),
      ]);

      const byDay = new Map(
        rollups.map((row) => [row.day.toISOString().slice(0, 10), row._sum.views ?? 0]),
      );

      const series: DashboardResponse['viewsChart']['series'] = [];
      for (let index = 0; index < 7; index += 1) {
        const day = new Date(weekStart.getTime() + index * 86_400_000);
        const key = day.toISOString().slice(0, 10);
        series.push({
          day: day.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
          date: key,
          views: byDay.get(key) ?? 0,
          heightPct: 0,
        });
      }

      const max = Math.max(1, ...series.map((point) => point.views));
      for (const point of series) {
        point.heightPct = Math.round((point.views / max) * 100);
      }

      const weekTotal = series.reduce((sum, point) => sum + point.views, 0);
      const previousTotal = previousRollups._sum.views ?? 0;
      const viewDelta =
        previousTotal === 0
          ? null
          : Math.round(((weekTotal - previousTotal) / previousTotal) * 100);

      const firstName = (owner?.user.fullName ?? dealer.brandName).split(' ').pop() ?? '';

      return {
        greeting: `${greeting()}, ${firstName}`,
        subline: 'Here is what happened across your inventory in the last 7 days.',
        stats: [
          {
            key: 'activeListings',
            label: 'Active listings',
            value: dealer.activeListings,
            valueLabel: String(dealer.activeListings),
            delta: addedThisWeek > 0 ? `+${addedThisWeek} this week` : 'No change this week',
            deltaTone: addedThisWeek > 0 ? 'ok' : 'neutral',
          },
          {
            key: 'credits',
            label: 'Available credits',
            value: dealer.creditBalance,
            valueLabel: dealer.creditBalance.toLocaleString('en-IN'),
            delta: `${usedThisMonth} used this month`,
            deltaTone: 'neutral',
          },
          {
            key: 'newEnquiries',
            label: 'New enquiries',
            value: newEnquiries,
            valueLabel: String(newEnquiries),
            delta:
              previousEnquiries === 0
                ? 'First week of enquiries'
                : `${newEnquiries - previousEnquiries >= 0 ? '+' : '−'}${Math.abs(
                    newEnquiries - previousEnquiries,
                  )} vs last week`,
            deltaTone: newEnquiries >= previousEnquiries ? 'ok' : 'warn',
          },
          {
            key: 'views',
            label: 'Vehicle views',
            value: weekTotal,
            valueLabel: weekTotal.toLocaleString('en-IN'),
            delta:
              viewDelta === null
                ? 'No data for last week'
                : `${viewDelta >= 0 ? '+' : '−'}${Math.abs(viewDelta)}% vs last week`,
            deltaTone: viewDelta === null || viewDelta >= 0 ? 'ok' : 'warn',
          },
        ],
        viewsChart: {
          title: 'Views this week',
          totalLabel: `${weekTotal.toLocaleString('en-IN')} total`,
          max,
          series,
        },
        recentEnquiries: recent.map((enquiry) => ({
          id: enquiry.id,
          initials: initialsOf(enquiry.name),
          name: enquiry.name,
          vehicleTitle: enquiry.vehicle
            ? [
                enquiry.vehicle.year,
                enquiry.vehicle.make.name,
                enquiry.vehicle.model.name,
                enquiry.vehicle.variant?.name,
              ]
                .filter(Boolean)
                .join(' ')
            : null,
          phoneDisplay: formatPhone(enquiry.phone),
          callHref: `tel:${enquiry.phone}`,
          timeAgoLabel: timeAgo(enquiry.createdAt),
        })),
        creditBalance: dealer.creditBalance,
        creditsHeld: dealer.creditsHeld,
        alerts:
          expiringSoon > 0
            ? [
                {
                  type: 'EXPIRING_SOON',
                  count: expiringSoon,
                  message: `${expiringSoon} listing${expiringSoon === 1 ? '' : 's'} expire${
                    expiringSoon === 1 ? 's' : ''
                  } in the next 7 days.`,
                  href: '/dealer/inventory?status=ACTIVE',
                },
              ]
            : [],
      };
    },
  };
}

export type DealersService = ReturnType<typeof createDealersService>;

function documentStatusLabel(
  status: string,
  fileName: string | null,
  rejectionReason: string | null,
): string {
  switch (status) {
    case 'UPLOADED':
      return `${fileName ?? 'File'} · uploaded`;
    case 'VERIFIED':
      return `${fileName ?? 'File'} · verified`;
    case 'UPLOADING':
      return 'Uploading…';
    case 'REJECTED':
      return rejectionReason ?? 'Rejected — please upload a clearer copy';
    default:
      return 'Required — PDF or JPG, max 5 MB';
  }
}

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
