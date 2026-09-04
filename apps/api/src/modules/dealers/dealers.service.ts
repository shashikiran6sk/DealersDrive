import {
  DEALER_STATUS_LABELS,
  DOC_TYPE_LABELS,
  formatPhone,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentsResponse,
  type DealerSubmitResponse,
  type DealerProfile,
  type DocumentCommitInput,
  type DocumentPresignInput,
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
import type { DealerPrincipal } from '../auth/auth.facade.js';
import type { DealersRepository, DealerWithRelations } from './dealers.repository.js';

/**
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is 610 lines and covers the profile, the onboarding
 * completeness tracker, the KYC document paths and the dealer dashboard. Each
 * of those belongs to a feature further down the list, and each brings a
 * dependency this one does not have: `StoragePort` for the document
 * presigning, `EnquiriesRepository` for the dashboard, `Vehicle` and `Listing`
 * for the counters.
 *
 * `session()` landed with **F018** — the one method the auth module calls, and
 * the reason `dealers.facade.ts` re-exports `DealersService` at all.
 * `documents()` landed with **F040**. **F041** adds `toProfile`/`profile`,
 * `update`, and the three document write paths, and with them the first
 * dependency this service takes beyond its repository: `StoragePort`.
 *
 * F043 added `completeness()` and **F042** `submitForVerification()`, which
 * closes onboarding: every method the dealer-facing wizard calls is now here.
 * Still to come: `dashboard()` with **F048**, which brings
 * `EnquiriesRepository` and the `Listing` counters.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface DealersDeps {
  prisma: PrismaClient;
  repo: DealersRepository;
  storage: StoragePort;
}

/**
 * The closed set. Three documents, always, in this order — the checklist is
 * fixed rather than data-driven, because "which documents does KYC need" is a
 * regulatory answer and not a per-dealer one.
 */
const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'];

export function createDealersService({ prisma, repo, storage }: DealersDeps) {
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

    /**
     * The checklist, as the onboarding step and the console both render it.
     *
     * Every one of the three types is returned whether or not a row exists for
     * it — a response that grew as documents were uploaded would leave a
     * missing document looking like one that was never required.
     */
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
  };
}

export type DealersService = ReturnType<typeof createDealersService>;

/**
 * The sub-line under each row. It is a sentence a dealer can act on rather than
 * an enum name — `REJECTED` tells them nothing, "Too blurry to read" tells them
 * what to do next.
 */
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
