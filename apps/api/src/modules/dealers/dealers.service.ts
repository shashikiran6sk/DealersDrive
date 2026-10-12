import { withDealerRegistrationConflict } from './dealer-registration-conflict.js';
import { invalidateDealerVerification } from './dealer-verification.js';
import { isDealerVerified } from '@dealers-drive/contracts';
import { resolveOnboardingLocation } from '../service-locations/service-locations.facade.js';
import {
  dealerSessionNext,
  documentRequirement,
  isSubmittedDocument,
  DEALER_STATUS_LABELS,
  distinctServices,
  formatDate,
  formatPhone,
  formatRegistration,
  initialsOf,
  listingStatusTone,
  normaliseLocality,
  PROFILE_CHANGE_STATUS_LABELS,
  timeAgo,
  toE164,
  vehicleTitle,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentDto,
  type DealerDocumentsResponse,
  type SelectableDocCategory,
  type DashboardResponse,
  type DealerSubmitResponse,
  type DealerProfile,
  type DealerProfileChange,
  type DealerSelfUpdateInput,
  type DocumentCommitInput,
  type DocumentPresignInput,
  type PresignResponse,
  type UpdateDealerInput,
} from '@dealers-drive/contracts';
import type { DealerStatus, DocStatus, PrismaClient } from '@prisma/client';

import { randomUUID } from 'node:crypto';

import { getContext } from '../../middleware/request-context.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import { mapKindFor, type MapsPort } from '../../platform/maps/maps-link.js';
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import { assertPhoneVerified, type DealerPrincipal } from '../auth/auth.facade.js';
import { documentKey } from './dealer-storage-keys.js';
import { normaliseDealerEmail } from './dealer-email-identity.js';
import {
  ALREADY_SUBMITTED,
  APPLICATION_CLOSED,
  DOCUMENT_CONTENT_MISMATCH,
  DOCUMENT_LOCKED,
  DOCUMENT_SIZE_MISMATCH,
  SUBMITTED_MESSAGE,
} from './dealers.messages.js';
import { toDealerDocumentDto, toDealerDocuments } from './dealer-documents.mapper.js';
import { createDealerPortfolioService } from './dealer-portfolio.service.js';
import { sniffDocumentType } from '../../platform/media/sniff.js';
import type { DealersRepository, DealerWithRelations } from './dealers.repository.js';
import {
  ALREADY_REGISTERED,
  DOCUMENT_NOT_FOUND,
  UNNAMED_CUSTOMER,
  UPLOAD_INCOMPLETE,
} from '../../platform/messages.js';

export interface DocumentActor {
  type: 'DEALER' | 'SALES';
  id: string | null;
}

export interface SubmissionActor {
  type: 'DEALER' | 'ADMIN';
  id: string | null;
}

export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
  storage: StoragePort;
  maps: MapsPort;
  audit: AuditService;
}

const DOC_EDITABLE_OUTSIDE_DRAFT: readonly DocStatus[] = ['REQUIRED', 'REJECTED', 'UPLOADING'];

function assertDocumentEditable(
  dealerStatus: DealerStatus | null,
  document: { status: DocStatus } | null,
): void {
  if (dealerStatus === 'DRAFT') return;
  if (!document || DOC_EDITABLE_OUTSIDE_DRAFT.includes(document.status)) return;
  throw new ConflictError('DOCUMENT_LOCKED', DOCUMENT_LOCKED);
}

function assertSubmittable(dealerStatus: DealerStatus | null): void {
  if (dealerStatus === 'DRAFT') return;
  if (dealerStatus === 'CLOSED') throw new DomainError('APPLICATION_CLOSED', APPLICATION_CLOSED);
  throw new DomainError('ALREADY_SUBMITTED', ALREADY_SUBMITTED);
}

function sameServices(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const held = new Set(b);
  return a.every((value) => held.has(value));
}

const DASHBOARD_LISTING_STATS = [
  { status: 'ACTIVE', label: 'Active listings' },
  { status: 'RESERVED', label: 'Reserved' },
  { status: 'PENDING_REVIEW', label: 'Pending review' },
  { status: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { status: 'SOLD', label: 'Sold' },
] as const;

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
        fullName: owner?.user.fullName ?? dealer.contactName,
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
      taglineChanged: row.taglineChanged || row.tagline !== null,
      specialities: row.specialities,
      submittedAtLabel: formatDate(row.createdAt),
      reviewedAtLabel: row.reviewedAt ? formatDate(row.reviewedAt) : null,
      decisionReason: row.decisionReason,
    };
  }

  async function requireDealer(dealerId: string, tx?: Tx): Promise<DealerWithRelations> {
    const dealer = await repo.findById(dealerId, tx);
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

  return {
    portfolio: createDealerPortfolioService({ prisma, storage, audit }),
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
        next: dealerSessionNext(dealer.status),
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
          isVerified: isDealerVerified(dealer),
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

    async amendDraft(dealerId: string, input: UpdateDealerInput, tx?: Tx): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId, tx);
      if (dealer.status !== 'DRAFT') {
        throw new ConflictError(
          'PROFILE_LOCKED',
          'This dealership has been submitted for verification, so its name, address and contact details can no longer be edited here.',
        );
      }

      return this.update(dealerId, input, tx, true);
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

      const taglineChanged = input.tagline !== undefined && input.tagline !== dealer.tagline;
      const tagline = taglineChanged ? (input.tagline ?? null) : null;

      const typedServices =
        input.specialities === undefined ? null : distinctServices(input.specialities);
      const specialities =
        typedServices === null || sameServices(typedServices, dealer.specialities)
          ? []
          : typedServices;

      if (!taglineChanged && specialities.length === 0) {
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
          data: { dealerId, tagline, taglineChanged, specialities, submittedBy: actorUserId },
        });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: actorUserId,
          dealerId,
          action: 'dealer.profile_change.submitted',
          entityType: 'DealerProfileChange',
          entityId: saved.id,
          before: { tagline: dealer.tagline, specialities: dealer.specialities },
          after: { tagline, taglineChanged, specialities },
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
        await repo.lockStatus(dealerId, tx);
        const current = await requireDealer(dealerId, tx);
        if (
          !current.profileEdits.some((row) => row.id === pending.id && row.status === 'PENDING')
        ) {
          throw new NotFoundError('You have no change waiting for review.');
        }
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

    async update(
      dealerId: string,
      input: UpdateDealerInput,
      transaction?: Tx,
      draftOnly = false,
    ): Promise<DealerProfile> {
      const dealer = await requireDealer(dealerId, transaction);
      const owner = dealer.members.find((member) => member.role === 'OWNER');
      const email =
        input.contact?.email === undefined ? undefined : normaliseDealerEmail(input.contact.email);
      if (owner && email !== undefined && email !== normaliseDealerEmail(owner.user.email ?? '')) {
        throw new ConflictError(
          'OWNER_EMAIL_PROOF_REQUIRED',
          'The owner’s email is a verified account identity. Contact support to change it.',
          {
            errors: [
              {
                field: 'body.contact.email',
                code: 'OWNER_EMAIL_PROOF_REQUIRED',
                message: 'Changing the owner’s identity requires verification.',
              },
            ],
          },
        );
      }

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
        ...(input.gstin ? { gstin: input.gstin } : {}),
        ...(input.pan === undefined ? {} : { pan: input.pan }),
      });

      const work = async (tx: Tx) => {
        if (owner && input.contact?.fullName !== undefined) {
          await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${owner.userId}::uuid FOR UPDATE`;
        }
        await repo.lockStatus(dealerId, tx);
        const current = await requireDealer(dealerId, tx);
        if (draftOnly && current.status !== 'DRAFT') {
          throw new ConflictError(
            'PROFILE_LOCKED',
            'This dealership has been submitted for verification, so its name, address and contact details can no longer be edited here.',
          );
        }
        const locationChanged =
          (state !== undefined && state !== current.state) ||
          (district !== undefined && district !== current.district);
        const location = locationChanged
          ? await resolveOnboardingLocation(
              tx,
              state ?? current.state ?? '',
              district ?? current.district ?? '',
              'body.address',
            )
          : {};
        if (input.contact?.fullName !== undefined && owner) {
          await tx.user.update({
            where: { id: owner.userId },
            data: {
              ...(input.contact.fullName === undefined ? {} : { fullName: input.contact.fullName }),
            },
          });
        }

        const identityChanged =
          (input.legalName !== undefined && input.legalName !== current.legalName) ||
          (input.gstin !== undefined && input.gstin !== current.gstin) ||
          (input.pan !== undefined && input.pan !== current.pan) ||
          (email !== undefined && email !== current.contactEmail) ||
          (phone !== undefined && phone !== current.contactPhone) ||
          (input.contact?.fullName !== undefined &&
            input.contact.fullName !==
              current.members.find((member) => member.role === 'OWNER')?.user.fullName) ||
          (input.address?.line !== undefined && input.address.line !== current.addressLine) ||
          (city !== undefined && city !== current.city) ||
          locationChanged ||
          (input.address?.pincode !== undefined && input.address.pincode !== current.pincode);
        if (identityChanged)
          await invalidateDealerVerification(
            tx,
            audit,
            current,
            { actorType: 'SYSTEM', actorId: getContext()?.userId ?? null },
            'Business identity or contact evidence changed; a new review is required.',
          );
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
            ...(email === undefined ? {} : { contactEmail: email }),
            ...(email === undefined || email === dealer.contactEmail
              ? {}
              : { contactEmailVerifiedAt: null }),
            ...(phone === undefined ? {} : { contactPhone: phone }),
            ...(input.contact?.landline === undefined ? {} : { landline: input.contact.landline }),
            ...(input.address?.line === undefined ? {} : { addressLine: input.address.line }),
            ...(city === undefined ? {} : { city }),
            ...(district === undefined ? {} : { district }),
            ...(state === undefined ? {} : { state }),
            ...location,
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
      };
      const updated = transaction
        ? await work(transaction)
        : await withDealerRegistrationConflict(
            () => withTransaction(prisma, work),
            'body.contact.email',
          );

      return toProfile(updated);
    },

    async completeness(dealerId: string, tx?: Tx): Promise<CompletenessResponse> {
      const dealer = await requireDealer(dealerId, tx);
      const owner = dealer.members.find((member) => member.role === 'OWNER');
      const documents = await repo.documents(dealerId, tx);

      const accountMissing: string[] = [];
      if (owner) {
        if (!owner.user.fullName) accountMissing.push('fullName');
        if (!owner.user.email || !owner.user.emailVerifiedAt) accountMissing.push('email');
        if (!owner.user.phone || !owner.user.phoneVerifiedAt) accountMissing.push('phone');
      } else {
        accountMissing.push('owner');
      }

      const businessMissing: string[] = [];
      if (!dealer.legalName) businessMissing.push('legalName');
      if (!dealer.addressLine) businessMissing.push('addressLine');
      if (!dealer.city) businessMissing.push('city');
      if (!dealer.district) businessMissing.push('district');
      if (!dealer.state) businessMissing.push('state');
      if (!dealer.pincode) businessMissing.push('pincode');
      if (!dealer.mapsUrl) businessMissing.push('mapsUrl');
      if (dealer.specialities.length === 0) businessMissing.push('specialities');

      const documentsMissing: string[] = documentRequirement(
        documents,
        dealer.gstin,
        isSubmittedDocument,
      ).gaps;

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

    async submitForVerification(
      dealerId: string,
      actor: SubmissionActor = { type: 'DEALER', id: null },
    ): Promise<DealerSubmitResponse> {
      const dealer = await requireDealer(dealerId);
      assertSubmittable(dealer.status);

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
        assertSubmittable(await repo.lockStatus(dealerId, tx));
        await repo.update(dealerId, { status: 'PENDING_APPROVAL', statusReason: null }, tx);
        await audit.record(tx, {
          actorType: actor.type,
          actorId: actor.id,
          dealerId,
          action: 'dealer.submitted',
          entityType: 'Dealer',
          entityId: dealerId,
          before: { status: 'DRAFT' },
          after: {
            status: 'PENDING_APPROVAL',
            resubmitted,
            onboardingSource: dealer.onboardingSource,
            ...(dealer.assistedByMemberId ? { assistedByMemberId: dealer.assistedByMemberId } : {}),
          },
        });
        await enqueueOutbox(tx, {
          type: 'DealerApplied',
          aggregateType: 'Dealer',
          aggregateId: dealerId,
          dealerId,
          actor: { type: actor.type, ...(actor.id ? { id: actor.id } : {}) },
          traceId: getContext()?.traceId ?? 'dealer-submit',
          payload: {
            dealerId,
            resubmitted,
            assisted: dealer.onboardingSource === 'ASSISTED',
          },
        });
      });

      return {
        status: 'PENDING_APPROVAL',
        statusLabel: 'Under review',
        submittedAt: submittedAt.toISOString(),
        expectedDecisionBy: new Date(submittedAt.getTime() + 86_400_000).toISOString(),
        message: SUBMITTED_MESSAGE,
      };
    },

    async documents(dealerId: string): Promise<DealerDocumentsResponse> {
      const dealer = await requireDealer(dealerId);
      return toDealerDocuments(await repo.documents(dealerId), dealer.gstin);
    },

    async presignDocument(dealerId: string, input: DocumentPresignInput): Promise<PresignResponse> {
      const slug = await requireSlug(dealerId);
      const documentId = randomUUID();
      const key = documentKey(slug, input.type, documentId);

      const previous = await withTransaction(prisma, async (tx) => {
        const dealerStatus = await repo.lockStatus(dealerId, tx);
        const existing = await repo.documentByCategory(dealerId, input.category, tx);
        assertDocumentEditable(dealerStatus, existing);

        await repo.upsertDocument(
          dealerId,
          input.category,
          {
            id: documentId,
            type: input.type,
            status: 'UPLOADING',
            fileName: input.fileName,
            description: input.description ?? null,
            mimeType: input.mimeType,
            bytes: input.bytes,
            uploadedAt: null,
            mediaId: null,
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
          },
          tx,
        );
        return existing;
      });
      if (previous?.fileName) await storage.delete(documentKey(slug, previous.type, previous.id));

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

    async commitDocument(
      dealerId: string,
      category: SelectableDocCategory,
      input: DocumentCommitInput,
      actor: DocumentActor = { type: 'DEALER', id: null },
    ): Promise<DealerDocumentDto> {
      const slug = await requireSlug(dealerId);
      const pending = await repo.documentById(input.documentId);
      if (!pending || pending.dealerId !== dealerId || pending.category !== category) {
        throw new NotFoundError(DOCUMENT_NOT_FOUND);
      }
      if (pending.status === 'UPLOADED' || pending.status === 'VERIFIED') {
        return toDealerDocumentDto(pending);
      }
      const key = documentKey(slug, pending.type, pending.id);
      const object = await storage.head(key);
      const body = object ? await storage.get(key) : null;
      const sniffed = body ? sniffDocumentType(body) : null;
      const failure =
        !object || !body
          ? new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE)
          : object.bytes !== pending.bytes || body.length !== pending.bytes
            ? new DomainError('DOCUMENT_SIZE_MISMATCH', DOCUMENT_SIZE_MISMATCH)
            : sniffed !== pending.mimeType
              ? new DomainError('DOCUMENT_CONTENT_MISMATCH', DOCUMENT_CONTENT_MISMATCH)
              : null;

      const committed = await withTransaction(prisma, async (tx) => {
        const dealerStatus = await repo.lockStatus(dealerId, tx);
        const doc = await repo.documentById(input.documentId, tx);
        if (!doc || doc.dealerId !== dealerId || doc.category !== category) {
          throw new NotFoundError(DOCUMENT_NOT_FOUND);
        }
        if (doc.status === 'UPLOADED' || doc.status === 'VERIFIED') return { doc, fresh: false };
        assertDocumentEditable(dealerStatus, doc);
        if (failure) {
          if (object) await repo.deleteDocument(dealerId, category, tx);
          return { doc, fresh: false };
        }
        const updated = await repo.updateDocument(
          doc.id,
          {
            status: 'UPLOADED',
            mediaId: null,
            uploadedAt: new Date(),
            submissionCount: { increment: 1 },
          },
          tx,
        );
        await audit.record(tx, {
          actorType: actor.type,
          actorId: actor.id,
          dealerId,
          action: 'document.submitted',
          entityType: 'DealerDocument',
          entityId: doc.id,
          after: {
            category,
            type: doc.type,
            mimeType: doc.mimeType,
            bytes: doc.bytes,
            resubmission: updated.submissionCount > 1,
          },
        });
        return { doc: updated, fresh: true };
      });
      if (failure) {
        if (object) await storage.delete(key);
        throw failure;
      }
      return toDealerDocumentDto(committed.doc);
    },

    async deleteDocument(dealerId: string, category: SelectableDocCategory): Promise<void> {
      const slug = await requireSlug(dealerId);
      const existing = await withTransaction(prisma, async (tx) => {
        const dealerStatus = await repo.lockStatus(dealerId, tx);
        const doc = await repo.documentByCategory(dealerId, category, tx);
        if (!doc) throw new NotFoundError(DOCUMENT_NOT_FOUND);
        if (doc.status === 'REQUIRED') return null;
        assertDocumentEditable(dealerStatus, doc);

        await repo.deleteDocument(dealerId, category, tx);
        return doc;
      });
      if (existing) await storage.delete(documentKey(slug, existing.type, existing.id));
    },

    async dashboard(dealerId: string, viewerId?: string): Promise<DashboardResponse> {
      const dealer = await requireDealer(dealerId);
      const viewer =
        dealer.members.find((member) => member.userId === viewerId) ??
        dealer.members.find((member) => member.role === 'OWNER');

      const weekStart = startOfDayUtc(new Date(Date.now() - 6 * 86_400_000));

      const [
        rollups,
        previousTotalOrNull,
        enquiryCounts,
        recent,
        expiringSoon,
        activity,
        listings,
      ] = await Promise.all([
        repo.viewRollups(dealerId, weekStart),
        repo.previousWeekViews(dealerId, weekStart),
        repo.enquiryCounts(dealerId, weekStart),
        repo.recentEnquiries(dealerId, 4),
        repo.expiringListingCount(dealerId, new Date(Date.now() + 7 * 86_400_000)),
        repo.weeklyActivity(dealerId, weekStart, startOfMonthUtc()),
        repo.listingCounts(dealerId),
      ]);
      const activeListings = listings.ACTIVE ?? 0;
      const changesRequested = listings.CHANGES_REQUESTED ?? 0;

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

      const firstName = (viewer?.user.fullName ?? dealer.brandName).split(' ').pop() ?? '';

      return {
        greeting: `${greeting()}, ${firstName}`,
        subline: 'Here is what happened across your inventory in the last 7 days.',
        stats: [
          {
            key: 'activeListings',
            label: 'Active listings',
            value: activeListings,
            valueLabel: String(activeListings),
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
        recentEnquiries: recent.map((enquiry) => {
          const name = enquiry.name?.trim() || UNNAMED_CUSTOMER;
          return {
            id: enquiry.id,
            initials: initialsOf(name),
            name,
            vehicleTitle:
              vehicleTitle(enquiry.vehicle) ||
              formatRegistration(enquiry.vehicle.registrationNumber),
            phoneDisplay: enquiry.phone ? formatPhone(enquiry.phone) : null,
            callHref: enquiry.phone ? `tel:${enquiry.phone}` : null,
            timeAgoLabel: timeAgo(enquiry.createdAt),
          };
        }),
        creditBalance: dealer.creditBalance,
        creditsHeld: dealer.creditsHeld,
        listingStats: DASHBOARD_LISTING_STATS.map((stat) => ({
          key: stat.status,
          label: stat.label,
          value: listings[stat.status] ?? 0,
          href: `/dealer/inventory?status=${stat.status}`,
          tone: listingStatusTone(stat.status),
        })),
        alerts: [
          ...(changesRequested > 0
            ? [
                {
                  type: 'CHANGES_REQUESTED',
                  count: changesRequested,
                  message: `${String(changesRequested)} vehicle${
                    changesRequested === 1 ? ' needs' : 's need'
                  } changes before ${changesRequested === 1 ? 'it goes' : 'they go'} live.`,
                  href: '/dealer/inventory?status=CHANGES_REQUESTED',
                },
              ]
            : []),
          ...(expiringSoon > 0
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
            : []),
        ],
      };
    },
  };
}

export type DealersService = ReturnType<typeof createDealersService>;

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
