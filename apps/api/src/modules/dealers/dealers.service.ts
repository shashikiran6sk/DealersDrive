import {
  DEALER_STATUS_LABELS,
  DOC_TYPE_LABELS,
  formatPhone,
  normaliseLocality,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentsResponse,
  type DealerSubmitResponse,
  type DealerProfile,
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
import { enqueueOutbox } from '../../platform/events/bus.js';
import { ConflictError, DomainError, NotFoundError } from '../../platform/errors.js';
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

/**
 * How long a yard-photo read URL is good for.
 *
 * The same five minutes a KYC document gets. The image is destined to be
 * public, but it is not public *yet* — a dealership in DRAFT has not been
 * looked at by anybody, and until it has, its photographs are as private as
 * the rest of the application.
 */
const YARD_PHOTO_URL_TTL_SECONDS = 300;

/** Where a yard photograph lives. Not under `kyc/`: it is not a KYC document. */
function yardPhotoKey(dealerId: string, mediaId: string): string {
  return `dealers/${dealerId}/yard/${mediaId}`;
}

/** Where a KYC document lives. The row's id is the last segment. */
function documentKey(dealerId: string, type: DealerDocType, documentId: string): string {
  return `kyc/${dealerId}/${type}/${documentId}`;
}

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
        city: dealer.city,
        state: dealer.state,
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

  /**
   * Two dealerships in one city must not share a registered name, and no two
   * anywhere may share a GSTIN.
   *
   * The unique indexes on `(legalName, city)` and `gstin` are what actually
   * guarantee it, and they are what makes this safe against two applications
   * racing. This read exists for the other half of the job: turning a
   * collision into a message against the field the dealer just typed, rather
   * than a Prisma P2002 the error handler renders as a 500.
   *
   * The name is always asked about together with a city — the one being moved
   * to, or the one the dealership is already in — because a name on its own
   * cannot be a duplicate of anything.
   */
  async function assertNoDuplicate(
    dealerId: string,
    fields: { legalName?: string; city?: string; gstin?: string },
  ): Promise<void> {
    const clash = await repo.findConflicting(dealerId, fields);

    // `clash.legalName` is only ever true when both were asked about, so the
    // message can name them without a fallback that would never be reached.
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
              message: 'Already registered.',
            },
          ],
        },
      );
    }
  }

  /** Remove the bytes, keep the row as ORPHAN so a sweeper can reconcile it. */
  async function discardMedia(mediaId: string): Promise<void> {
    const media = await repo.mediaById(mediaId);
    if (!media) return;
    await repo.orphanMedia(mediaId);
    await storage.delete(media.storageKey);
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

      /**
       * Locality as text, normalised once here.
       *
       * A slug resolved against `cities` until the table went; the note on
       * `UpdateDealerInput.address` in contracts records why. `lat`/`lng` came
       * off that row and are no longer written — nothing reads them yet, and
       * geocoding a typed address is a separate concern from saving it.
       */
      const city = input.address?.city === undefined
        ? undefined
        : normaliseLocality(input.address.city);
      const state = input.address?.state === undefined
        ? undefined
        : normaliseLocality(input.address.state);

      /**
       * A rename is checked against the city it will be in once this PATCH
       * lands, which is not always the city the dealership is in now: a dealer
       * changing both fields in one submit must be checked against the pair
       * they typed, not against a half-applied combination of the two.
       */
      const nameCity = city ?? dealer.city ?? undefined;
      await assertNoDuplicate(dealerId, {
        ...(input.legalName === undefined || nameCity === undefined
          ? {}
          : { legalName: input.legalName, city: nameCity }),
        ...(input.gstin === undefined ? {} : { gstin: input.gstin }),
      });

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
            // One name. `brandName` is the display mirror and is written here
            // rather than accepted from the client, which is why
            // `UpdateDealerInput` does not carry it.
            ...(input.legalName === undefined
              ? {}
              : { legalName: input.legalName, brandName: input.legalName }),
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
            ...(city === undefined ? {} : { city }),
            ...(state === undefined ? {} : { state }),
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
      if (!dealer.legalName) businessMissing.push('legalName');
      if (!dealer.addressLine) businessMissing.push('addressLine');
      if (!dealer.city) businessMissing.push('city');
      if (!dealer.state) businessMissing.push('state');
      if (!dealer.pincode) businessMissing.push('pincode');
      if (!dealer.gstin) businessMissing.push('gstin');
      if (!dealer.pan) businessMissing.push('pan');

      const documentsMissing: string[] = DOC_TYPES.filter((type) => {
        const doc = documents.find((row) => row.type === type);
        return !doc || doc.status === 'REQUIRED' || doc.status === 'REJECTED';
      });

      // The yard photograph sits on the documents step because that is the
      // step where a dealer uploads things — but it is required for a
      // different reason. It is the hero of the public portfolio, and a
      // dealership whose storefront would open with an empty frame is not
      // ready to be reviewed.
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
      const key = documentKey(dealerId, input.type, documentId);

      /**
       * Replacing removes what was there.
       *
       * The row is about to be overwritten with a new id, and the stored
       * object's key ends in the old one — so this is the last moment anything
       * knows where the previous file is. Skip it and every replacement leaves
       * a KYC document sitting in storage that nothing references and nothing
       * will ever delete, which for scans of PAN cards is a retention problem
       * rather than a housekeeping one.
       */
      const previous = await repo.documentByType(dealerId, input.type);
      if (previous) await storage.delete(documentKey(dealerId, input.type, previous.id));

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

      const object = await storage.head(documentKey(dealerId, type, input.documentId));
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }

      await repo.upsertDocument(dealerId, type, { status: 'UPLOADED', mediaId: null });
      const response = await this.documents(dealerId);
      return response.data.find((row) => row.type === type);
    },

    /**
     * C5 delete. The row survives as `REQUIRED` — the checklist has three rows
     * whatever happens to them — but the bytes do not.
     *
     * The row is read before it is reset, because the stored object's key ends
     * in the row's id. The baseline deleted `kyc/{dealerId}/{type}`, which is
     * the *prefix* the object lives under rather than the object itself, so
     * every removed document stayed in storage. That is fixed here.
     */
    async deleteDocument(dealerId: string, type: DealerDocType): Promise<void> {
      const existing = await repo.documentByType(dealerId, type);
      if (!existing) throw new NotFoundError('That document does not exist.');

      await repo.deleteDocument(dealerId, type);
      await storage.delete(documentKey(dealerId, type, existing.id));
    },

    // ─────────── The yard photograph ──────────────────────────────────────

    /**
     * The image that will front this dealership's public portfolio.
     *
     * It is deliberately not a fourth `DealerDocType`. The three KYC documents
     * are private, have no public delivery route and exist to be read once by a
     * moderator; this one is the first thing a buyer will ever see. Sharing the
     * pipeline is fine — sharing the checklist would mean sharing the privacy
     * rules, and those are the part that must not be got wrong.
     *
     * It lands on `dealer.coverMediaId`, because a hero image of the premises
     * is exactly what that slot is for.
     */
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
        /*
         * A signed read of the original, not a delivery URL.
         *
         * The derivative pipeline that content-addresses an image and gives it
         * a permanent public URL is **F034**. Until it exists the original is
         * the only copy there is, and signing a read of it is the only honest
         * way to show a dealer what they uploaded. When F034 lands this becomes
         * `mediaUrl(media.id, …)` for a READY row and the row stops being
         * PENDING; nothing else about this path changes.
         */
        url: await storage.signedReadUrl(media.storageKey, YARD_PHOTO_URL_TTL_SECONDS),
        uploadedAt: media.createdAt.toISOString(),
      };
    },

    async presignYardPhoto(
      dealerId: string,
      input: YardPhotoPresignInput,
    ): Promise<PresignResponse> {
      await requireDealer(dealerId);

      const mediaId = randomUUID();
      const key = yardPhotoKey(dealerId, mediaId);

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

    /**
     * Commit, and displace whatever was there.
     *
     * The delete happens *here* rather than at presign — the opposite of the
     * KYC path — because nothing is overwritten until this point. A presign
     * that is never followed by a `PUT` leaves the dealership's existing yard
     * photograph exactly where it was, which is what a dealer who changed their
     * mind halfway through picking a file expects.
     */
    async commitYardPhoto(dealerId: string, input: YardPhotoCommitInput): Promise<YardPhotoDto> {
      const dealer = await requireDealer(dealerId);

      const media = await repo.mediaById(input.mediaId);
      if (!media || media.dealerId !== dealerId || media.ownerType !== 'DEALER_COVER') {
        throw new NotFoundError('That upload does not exist.');
      }

      const object = await storage.head(media.storageKey);
      if (!object) {
        throw new DomainError('UPLOAD_MISSING', 'The upload did not complete. Try again.');
      }

      const displaced = dealer.coverMediaId;
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
