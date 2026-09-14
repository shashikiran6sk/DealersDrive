import {
  DEALER_STATUS_LABELS,
  distinctServices,
  DOC_TYPE_LABELS,
  formatDate,
  formatPhone,
  initialsOf,
  normaliseLocality,
  PROFILE_CHANGE_STATUS_LABELS,
  timeAgo,
  toE164,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentsResponse,
  type DashboardResponse,
  type DealerSubmitResponse,
  type DealerProfile,
  type DealerProfileChange,
  type DealerSelfUpdateInput,
  type DocumentCommitInput,
  type DocumentPresignInput,
  type PresignResponse,
  type UpdateDealerInput,
  type YardPhotoCommitInput,
  type YardPhotoDto,
  type YardPhotoPresignInput,
} from '@dealers-drive/contracts';
import type { DealerDocType, PrismaClient } from '@prisma/client';

import { toMediaStatus } from '../media/media.facade.js';
import { randomUUID } from 'node:crypto';

import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { mapKindFor, type MapsPort } from '../../platform/maps/maps-link.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { assertPhoneVerified, type DealerPrincipal } from '../auth/auth.facade.js';
import { documentKey, yardPhotoKey } from './dealer-storage-keys.js';
import type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
import {
  ALREADY_REGISTERED,
  DOCUMENT_NOT_FOUND,
  UPLOAD_INCOMPLETE,
  UPLOAD_NOT_FOUND,
} from '../../platform/messages.js';

export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
  storage: StoragePort;
  maps: MapsPort;
  audit: AuditService;
}

const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];

const YARD_PHOTO_URL_TTL_SECONDS = 300;

function sameServices(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const held = new Set(b);
  return a.every((value) => held.has(value));
}

export function createDealersService({ prisma, repo, storage, maps, audit }: DealersDeps) {
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
      gstin: dealer.gstin,
      pan: dealer.pan,
      contact: {
        fullName: owner?.user.fullName ?? null,
        phone: dealer.contactPhone ?? owner?.user.phone ?? '',
        phoneDisplay: formatPhone(dealer.contactPhone ?? owner?.user.phone ?? ''),
        email: owner?.user.email ?? dealer.contactEmail,
        landline: dealer.landline,
      },
      address: {
        line: dealer.addressLine,
        city: dealer.city,
        district: dealer.district,
        state: dealer.state,
        pincode: dealer.pincode,
        mapsUrl: dealer.mapsUrl,
        mapKind: mapKindFor({
          mapsUrl: dealer.mapsUrl,
          placeId: dealer.mapsPlaceId,
          coordinates:
            dealer.lat === null || dealer.lng === null
              ? null
              : { lat: dealer.lat, lng: dealer.lng },
        }),
      },
      specialities: dealer.specialities,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma types a Json column as JsonValue
      workingHours: dealer.workingHours as Record<string, string | null> | null,
      establishedYear: dealer.establishedYear,
      logoMediaId: dealer.logoMediaId,
      coverMediaId: dealer.coverMediaId,
      creditBalance: dealer.creditBalance,
      creditsHeld: dealer.creditsHeld,
      activeListings: dealer.activeListings,
      approvedAt: dealer.approvedAt?.toISOString() ?? null,
      createdAt: dealer.createdAt.toISOString(),
      profileChange: toProfileChange(dealer.profileEdits[0]),
    };
  }

  function toProfileChange(
    row: DealerWithRelations['profileEdits'][number] | undefined,
  ): DealerProfileChange | null {
    if (!row || row.status === 'APPROVED') return null;

    return {
      id: row.id,
      status: row.status,
      statusLabel: PROFILE_CHANGE_STATUS_LABELS[row.status],
      tagline: row.tagline,
      specialities: row.specialities,
      submittedAtLabel: formatDate(row.createdAt),
      reviewedAtLabel: row.reviewedAt ? formatDate(row.reviewedAt) : null,
      decisionReason: row.decisionReason,
    };
  }

  async function requireDealer(dealerId: string): Promise<DealerWithRelations> {
    const dealer = await repo.findById(dealerId);
    if (!dealer) throw new NotFoundError('That dealership no longer exists.');
    return dealer;
  }

  async function requireSlug(dealerId: string): Promise<string> {
    const slug = await repo.slugById(dealerId);
    if (!slug) throw new NotFoundError('That dealership no longer exists.');
    return slug;
  }

  async function assertNoDuplicate(
    dealerId: string,
    fields: { legalName?: string; city?: string; gstin?: string; pan?: string },
  ): Promise<void> {
    const clash = await repo.findConflicting(dealerId, fields);

    if (clash.legalName) {
      throw new ConflictError(
        'DEALER_NAME_TAKEN',
        `A dealership called ${String(fields.legalName)} is already registered in ${String(fields.city)}.`,
        {
          errors: [
            {
              field: 'body.legalName',
              code: 'DEALER_NAME_TAKEN',
              message: `Already registered in ${String(fields.city)}.`,
            },
          ],
        },
      );
    }

    if (clash.gstin) {
      throw new ConflictError(
        'GSTIN_ALREADY_REGISTERED',
        'That GSTIN is already registered to another dealership.',
        {
          errors: [
            {
              field: 'body.gstin',
              code: 'GSTIN_ALREADY_REGISTERED',
              message: ALREADY_REGISTERED,
            },
          ],
        },
      );
    }

    if (clash.pan) {
      throw new ConflictError(
        'PAN_ALREADY_REGISTERED',
        'That PAN is already registered to another dealership.',
        {
          errors: [
            {
              field: 'body.pan',
              code: 'PAN_ALREADY_REGISTERED',
              message: ALREADY_REGISTERED,
            },
          ],
        },
      );
    }
  }

  async function discardMedia(mediaId: string): Promise<void> {
    const media = await repo.mediaById(mediaId);
    if (!media) return;
    await repo.orphanMedia(mediaId);
    await storage.delete(media.storageKey);
  }

  return {
    toProfile,
    async session(principal: DealerPrincipal): Promise<AuthSession> {
      const dealer = await requireDealer(principal.dealerId);
      const owner = dealer.members.find((member) => member.userId === principal.userId);
      const [newEnquiries, pendingListings] = await Promise.all([
        repo.newEnquiryCount(dealer.id),
        repo.pendingListingCount(dealer.id),
      ]);

      const phone = owner?.user.phone ?? dealer.contactPhone ?? '';

      return {
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
          phone,
          phoneDisplay: formatPhone(phone),
          phoneVerified: owner?.user.phoneVerifiedAt != null && owner.user.phone === phone,
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

    async amendDraft(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      if (dealer.status !== 'DRAFT') {
        throw new ConflictError(
          'PROFILE_LOCKED',
          'This dealership has been submitted for verification, so its name, address and contact details can no longer be edited here.',
        );
      }

      return this.update(dealerId, input);
    },

    async selfUpdate(
      dealerId: string,
      actorUserId: string | null,
      input: DealerSelfUpdateInput,
    ): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);

      if (dealer.status !== 'ACTIVE') return this.update(dealerId, input);

      if (input.establishedYear !== undefined) {
        await this.update(dealerId, { establishedYear: input.establishedYear });
      }

      const tagline =
        input.tagline === undefined || input.tagline === dealer.tagline ? null : input.tagline;

      const typedServices =
        input.specialities === undefined ? null : distinctServices(input.specialities);
      const specialities =
        typedServices === null || sameServices(typedServices, dealer.specialities)
          ? []
          : typedServices;

      if (tagline === null && specialities.length === 0) {
        return toProfile(await requireDealer(dealerId));
      }

      const pending = dealer.profileEdits.find((row) => row.status === 'PENDING');
      if (pending) {
        throw new ConflictError(
          'PROFILE_EDIT_PENDING',
          'You already have a change waiting for review. Cancel it first if you want to write something different.',
        );
      }

      await withTransaction(prisma, async (tx) => {
        const saved = await tx.dealerProfileChange.create({
          data: { dealerId, tagline, specialities, submittedBy: actorUserId },
        });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actorUserId,
          dealerId,
          action: 'dealer.profile_change.submitted',
          entityType: 'DealerProfileChange',
          entityId: saved.id,
          before: { tagline: dealer.tagline, specialities: dealer.specialities },
          after: { tagline, specialities },
        });

        await enqueueOutbox(tx, {
          type: 'DealerProfileChangeSubmitted',
          aggregateType: 'DealerProfileChange',
          aggregateId: saved.id,
          dealerId,
          actor: { type: 'DEALER', ...(actorUserId === null ? {} : { id: actorUserId }) },
          traceId: getContext()?.traceId ?? 'profile-change-submitted',
          payload: { dealerId, profileChangeId: saved.id },
        });
      });

      return toProfile(await requireDealer(dealerId));
    },

    async withdrawProfileChange(
      dealerId: string,
      actorUserId: string | null,
    ): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      const pending = dealer.profileEdits.find((row) => row.status === 'PENDING');
      if (!pending) {
        throw new NotFoundError('You have no change waiting for review.');
      }

      await withTransaction(prisma, async (tx) => {
        await tx.dealerProfileChange.delete({ where: { id: pending.id } });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actorUserId,
          dealerId,
          action: 'dealer.profile_change.withdrawn',
          entityType: 'DealerProfileChange',
          entityId: pending.id,
          before: { tagline: pending.tagline, specialities: pending.specialities },
          after: null,
        });
      });

      return toProfile(await requireDealer(dealerId));
    },

    async update(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');

      const city =
        input.address?.city === undefined ? undefined : normaliseLocality(input.address.city);
      const district =
        input.address?.district === undefined
          ? undefined
          : normaliseLocality(input.address.district);
      const state =
        input.address?.state === undefined ? undefined : normaliseLocality(input.address.state);

      const specialities =
        input.specialities === undefined ? undefined : distinctServices(input.specialities);

      const phone = input.contact?.phone === undefined ? undefined : toE164(input.contact.phone);

      const mapsUrl = input.address?.mapsUrl;
      const place =
        mapsUrl === undefined || mapsUrl === dealer.mapsUrl
          ? undefined
          : await maps.placeFor(mapsUrl);

      if (phone !== undefined && owner) {
        await assertPhoneVerified(prisma, owner.userId, phone, 'body.contact.phone');
      }

      const nameCity = city ?? dealer.city ?? undefined;
      await assertNoDuplicate(dealerId, {
        ...(input.legalName === undefined || nameCity === undefined
          ? {}
          : { legalName: input.legalName, city: nameCity }),
        ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
        ...(input.pan === undefined ? {} : { pan: input.pan }),
      });

      const updated = await withTransaction(prisma, async (tx) => {
        if (input.contact && owner) {
          await tx.user.update({
            where: { id: owner.userId },
            data: {
              ...(input.contact.fullName === undefined ? {} : { fullName: input.contact.fullName }),
              ...(input.contact.email === undefined ? {} : { email: input.contact.email }),
            },
          });
        }

        return repo.update(
          dealerId,
          {
            ...(input.legalName === undefined
              ? {}
              : { legalName: input.legalName, brandName: input.legalName }),
            ...(input.tagline === undefined ? {} : { tagline: input.tagline }),
            ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
            ...(input.pan === undefined ? {} : { pan: input.pan }),
            ...(input.establishedYear === undefined
              ? {}
              : { establishedYear: input.establishedYear }),
            ...(specialities === undefined ? {} : { specialities }),
            ...(input.workingHours === undefined ? {} : { workingHours: input.workingHours }),
            ...(input.contact?.email === undefined ? {} : { contactEmail: input.contact.email }),
            ...(phone === undefined ? {} : { contactPhone: phone }),
            ...(input.contact?.landline === undefined ? {} : { landline: input.contact.landline }),
            ...(input.address?.line === undefined ? {} : { addressLine: input.address.line }),
            ...(city === undefined ? {} : { city }),
            ...(district === undefined ? {} : { district }),
            ...(state === undefined ? {} : { state }),
            ...(input.address?.pincode === undefined ? {} : { pincode: input.address.pincode }),
            ...(mapsUrl === undefined ? {} : { mapsUrl }),
            ...(place === undefined
              ? {}
              : {
                  lat: place.coordinates?.lat ?? null,
                  lng: place.coordinates?.lng ?? null,
                  mapsPlaceId: place.placeId,
                }),
          },
          tx,
        );
      });

      return toProfile(updated);
    },

    async completeness(dealerId: string): Promise<CompletenessResponse> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');
      const documents = await repo.documents(dealerId);

      const accountMissing: string[] = [];
      if (!owner?.user.fullName) accountMissing.push('fullName');
      if (!owner?.user.email) accountMissing.push('email');

      const businessMissing: string[] = [];
      if (!dealer.legalName) businessMissing.push('legalName');
      if (!dealer.addressLine) businessMissing.push('addressLine');
      if (!dealer.city) businessMissing.push('city');
      if (!dealer.district) businessMissing.push('district');
      if (!dealer.state) businessMissing.push('state');
      if (!dealer.pincode) businessMissing.push('pincode');
      if (!dealer.mapsUrl) businessMissing.push('mapsUrl');
      if (!dealer.tagline) businessMissing.push('tagline');
      if (dealer.specialities.length === 0) businessMissing.push('specialities');
      if (!dealer.gstin) businessMissing.push('gstin');
      if (!dealer.pan) businessMissing.push('pan');

      const documentsMissing: string[] = DOC_TYPES.filter((type) => {
        const doc = documents.find((row) => row.type === type);
        return !doc || doc.status === 'REQUIRED' || doc.status === 'REJECTED';
      });

      if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO');

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
      const resubmitted = Boolean(dealer.statusReason);
      await withTransaction(prisma, async (tx) => {
        await repo.update(dealerId, { status: 'PENDING_APPROVAL', statusReason: null }, tx);
        await enqueueOutbox(tx, {
          type: 'DealerApplied',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: 'DEALER' },
          traceId: getContext()?.traceId ?? 'dealer-submit',
          payload: { dealerId, resubmitted },
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

    async presignDocument(dealerId: string, input: DocumentPresignInput): Promise<PresignResponse> {
      const slug = await requireSlug(dealerId);
      const documentId = randomUUID();
      const key = documentKey(slug, input.type, documentId);

      const previous = await repo.documentByType(dealerId, input.type);
      if (previous) await storage.delete(documentKey(slug, input.type, previous.id));

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
        throw new NotFoundError(DOCUMENT_NOT_FOUND);
      }

      const object = await storage.head(
        documentKey(await requireSlug(dealerId), type, input.documentId),
      );
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
      }

      await repo.upsertDocument(dealerId, type, { status: 'UPLOADED', mediaId: null });
      const response = await this.documents(dealerId);
      return response.data.find((row) => row.type === type);
    },

    async deleteDocument(dealerId: string, type: DealerDocType): Promise<void> {
      const slug = await requireSlug(dealerId);
      const existing = await repo.documentByType(dealerId, type);
      if (!existing) throw new NotFoundError(DOCUMENT_NOT_FOUND);

      await repo.deleteDocument(dealerId, type);
      await storage.delete(documentKey(slug, type, existing.id));
    },

    async yardPhoto(dealerId: string): Promise<YardPhotoDto> {
      const dealer = await requireDealer(dealerId);
      if (!dealer.coverMediaId) {
        return { mediaId: null, status: null, fileName: null, url: null, uploadedAt: null };
      }

      const media = await repo.mediaById(dealer.coverMediaId);
      if (!media) {
        return { mediaId: null, status: null, fileName: null, url: null, uploadedAt: null };
      }

      return {
        mediaId: media.id,
        status: toMediaStatus(media.status),
        fileName: media.fileName,
        url: await storage.signedReadUrl(media.storageKey, YARD_PHOTO_URL_TTL_SECONDS),
        uploadedAt: media.createdAt.toISOString(),
      };
    },

    async presignYardPhoto(
      dealerId: string,
      input: YardPhotoPresignInput,
    ): Promise<PresignResponse> {
      const dealer = await requireDealer(dealerId);

      const mediaId = randomUUID();
      const key = yardPhotoKey(dealer.slug, mediaId);

      await repo.createMedia({
        id: mediaId,
        dealerId,
        ownerType: 'DEALER_COVER',
        storageKey: key,
        mimeType: input.mimeType,
        bytes: input.bytes,
        width: input.width ?? null,
        height: input.height ?? null,
        fileName: input.fileName,
        warnings: [],
        status: 'PENDING',
      });

      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });

      return {
        mediaId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
        maxBytes: input.bytes,
      };
    },

    async commitYardPhoto(dealerId: string, input: YardPhotoCommitInput): Promise<YardPhotoDto> {
      const dealer = await requireDealer(dealerId);

      const media = await repo.mediaById(input.mediaId);
      if (!media || media.dealerId !== dealerId || media.ownerType !== 'DEALER_COVER') {
        throw new NotFoundError(UPLOAD_NOT_FOUND);
      }

      const object = await storage.head(media.storageKey);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
      }

      const displaced = dealer.coverMediaId;
      await repo.markMediaReady(media.id);
      await repo.update(dealerId, { coverMediaId: media.id });
      if (displaced && displaced !== media.id) await discardMedia(displaced);

      return this.yardPhoto(dealerId);
    },

    async deleteYardPhoto(dealerId: string): Promise<void> {
      const dealer = await requireDealer(dealerId);
      if (!dealer.coverMediaId) throw new NotFoundError('There is no yard photograph to remove.');

      await repo.update(dealerId, { coverMediaId: null });
      await discardMedia(dealer.coverMediaId);
    },

    async dashboard(dealerId: string): Promise<DashboardResponse> {
      const dealer = await requireDealer(dealerId);
      const owner = dealer.members.find((member) => member.role === 'OWNER');

      const weekStart = startOfDayUtc(new Date(Date.now() - 6 * 86_400_000));

      const [rollups, previousTotalOrNull, enquiryCounts, recent, expiringSoon, activity] =
        await Promise.all([
          repo.viewRollups(dealerId, weekStart),
          repo.previousWeekViews(dealerId, weekStart),
          repo.enquiryCounts(dealerId, weekStart),
          repo.recentEnquiries(dealerId, 4),
          repo.expiringListingCount(dealerId, new Date(Date.now() + 7 * 86_400_000)),
          repo.weeklyActivity(dealerId, weekStart, startOfMonthUtc()),
        ]);

      const byDay = new Map(
        rollups.map((row) => [row.day.toISOString().slice(0, 10), row.views ?? 0]),
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
      const viewDelta =
        previousTotalOrNull === null || previousTotalOrNull === 0
          ? null
          : Math.round(((weekTotal - previousTotalOrNull) / previousTotalOrNull) * 100);

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
            delta:
              activity.listingsAddedThisWeek > 0
                ? `+${String(activity.listingsAddedThisWeek)} this week`
                : 'No change this week',
            deltaTone: activity.listingsAddedThisWeek > 0 ? 'ok' : 'neutral',
          },
          {
            key: 'credits',
            label: 'Available credits',
            value: dealer.creditBalance,
            valueLabel: dealer.creditBalance.toLocaleString('en-IN'),
            delta: `${String(activity.creditsUsedThisMonth)} used this month`,
            deltaTone: 'neutral',
          },
          {
            key: 'newEnquiries',
            label: 'New enquiries',
            value: enquiryCounts.thisWeek,
            valueLabel: String(enquiryCounts.thisWeek),
            delta:
              enquiryCounts.previousWeek === 0
                ? 'First week of enquiries'
                : `${enquiryCounts.thisWeek - enquiryCounts.previousWeek >= 0 ? '+' : '−'}${String(
                    Math.abs(enquiryCounts.thisWeek - enquiryCounts.previousWeek),
                  )} vs last week`,
            deltaTone: enquiryCounts.thisWeek >= enquiryCounts.previousWeek ? 'ok' : 'warn',
          },
          {
            key: 'views',
            label: 'Vehicle views',
            value: weekTotal,
            valueLabel: weekTotal.toLocaleString('en-IN'),
            delta:
              viewDelta === null
                ? 'No data for last week'
                : `${viewDelta >= 0 ? '+' : '−'}${String(Math.abs(viewDelta))}% vs last week`,
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
                  message: `${String(expiringSoon)} listing${expiringSoon === 1 ? '' : 's'} expire${
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
