import { z } from 'zod';

import { Uuid } from './common.js';
import { DealerDocType, DealerStatus, DocStatus, MediaStatus } from './enums.js';

/**
 * PART C — the dealer console (API-SPEC C1–C20). Every shape here is read or
 * written by somebody holding a `DealerPrincipal`, which is why not one of them
 * names a `dealerId`: that comes from the session (CLAUDE.md rule 1).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~800 lines covering the dealership profile, onboarding,
 * KYC documents, the vehicle wizard, RC lookup, inventory, media and enquiries.
 * Each shape arrives with the feature that first sends or answers with it; the
 * C14 media block below is here because **F033** is, the C5 KYC read shapes
 * because **F040** is, and C1/C2 plus the C5 write shapes because **F041** is.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Shared by the two presign paths — C14 media (**F033**) and the KYC document
 * upload (**F041**) — which is why both id fields are optional. One schema
 * rather than two, so the response shape a client parses cannot drift between
 * them.
 */
export const PresignResponse = z.object({
  documentId: Uuid.optional(),
  mediaId: Uuid.optional(),
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int(),
  maxBytes: z.number().int().optional(),
});
export type PresignResponse = z.infer<typeof PresignResponse>;

// ─────────── C1/C2 dealer profile ──────────────────────────────────────────
export const DealerProfile = z.object({
  id: Uuid,
  slug: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusReason: z.string().nullable(),
  brandName: z.string(),
  legalName: z.string(),
  tagline: z.string().nullable(),
  about: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  contact: z.object({
    fullName: z.string().nullable(),
    roleTitle: z.string().nullable(),
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.string().nullable(),
    landline: z.string().nullable(),
  }),
  address: z.object({
    line: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    pincode: z.string().nullable(),
  }),
  specialities: z.array(z.string()),
  workingHours: z.record(z.string(), z.string().nullable()).nullable(),
  establishedYear: z.number().int().nullable(),
  logoMediaId: Uuid.nullable(),
  coverMediaId: Uuid.nullable(),
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  activeListings: z.number().int(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DealerProfile = z.infer<typeof DealerProfile>;

const GSTIN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'GSTIN must be 15 characters.',
  );

const PAN = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like AABCS1429P.');

/**
 * Partial by design: each wizard step PATCHes only its own fields, so `Back`
 * never loses data. `phone` is absent — it is the login identity and changing
 * it needs an OTP round-trip on the new number.
 */
export const UpdateDealerInput = z
  .object({
    /**
     * The dealership's registered name, and the only name it has. `brandName`
     * is absent from this schema deliberately: it is the server-written display
     * mirror of `legalName`, and a client able to set the two independently is
     * a client able to make them disagree.
     */
    legalName: z.string().trim().min(2).max(160).optional(),
    tagline: z.string().trim().max(200).optional(),
    about: z.string().trim().max(4000).optional(),
    gstin: GSTIN.optional(),
    pan: PAN.optional(),
    establishedYear: z.number().int().min(1900).max(2100).optional(),
    specialities: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    workingHours: z.record(z.string(), z.string().nullable()).optional(),
    contact: z
      .object({
        fullName: z.string().trim().min(2).max(80).optional(),
        roleTitle: z.string().trim().max(60).optional(),
        email: z.string().trim().email().optional(),
        landline: z.string().trim().max(24).optional(),
      })
      .strict()
      .optional(),
    address: z
      .object({
        line: z.string().trim().max(200).optional(),
        /**
         * Locality as free text, not as a foreign key.
         *
         * ── Deliberate divergence from the baseline ───────────────────────
         * The baseline resolved a `citySlug` against a five-row `cities`
         * table, and took the dealership's coordinates off the row it found.
         * That made the reach of the product a database migration: a dealer in
         * Salem could not complete this form, and a dealer in Bengaluru could
         * not be described by it at all, because `state` was whatever the
         * catalogue said rather than where the yard is.
         *
         * So the table is gone and both are typed. The cost is that
         * `lat`/`lng` are no longer set here — a city row carried them, a
         * string cannot — and geocoding is a separate concern with its own
         * feature. Nothing reads those columns yet; the distance sort that
         * will arrives with search.
         * ──────────────────────────────────────────────────────────────────
         */
        city: z.string().trim().min(2).max(80).optional(),
        state: z.string().trim().min(2).max(80).optional(),
        pincode: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'Pincode must be 6 digits.')
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type UpdateDealerInput = z.infer<typeof UpdateDealerInput>;

// ─────────── C3 completeness ───────────────────────────────────────────────
/**
 * The single derived answer to "what is still missing".
 *
 * It is derived once, on the server, and read by two callers that must agree:
 * the wizard, which uses it to say what is outstanding, and
 * `POST /v1/dealer/submit`, which uses the same condition to refuse a premature
 * submit. Two independent derivations would eventually disagree, and the
 * disagreement would be about whether a dealer is allowed to trade.
 *
 * `missing` carries field keys — `gstin`, `GST_CERTIFICATE` — which are precise
 * and not something to put in front of somebody at the end of a sign-up form.
 * The wizard maps them to words.
 */
export const CompletenessResponse = z.object({
  isComplete: z.boolean(),
  canSubmit: z.boolean(),
  percent: z.number().int(),
  steps: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      complete: z.boolean(),
      missing: z.array(z.string()),
    }),
  ),
});
export type CompletenessResponse = z.infer<typeof CompletenessResponse>;

export const DealerSubmitResponse = z.object({
  status: DealerStatus,
  statusLabel: z.string(),
  submittedAt: z.string(),
  expectedDecisionBy: z.string(),
  message: z.string(),
});
export type DealerSubmitResponse = z.infer<typeof DealerSubmitResponse>;

// ─────────── C5 KYC documents ──────────────────────────────────────────────
/**
 * One row of the KYC checklist.
 *
 * `id` is nullable and `status` defaults to `REQUIRED`, because the response
 * describes **all three document types whether or not a row exists** — a
 * checklist that grew as documents were uploaded would read as "not required"
 * for the ones still missing.
 *
 * `statusLabel` and `action` are derived server-side rather than in the client.
 * Two clients deriving them independently would eventually disagree about what
 * a dealer is being asked to do next.
 */
export const DealerDocumentDto = z.object({
  id: Uuid.nullable(),
  type: DealerDocType,
  label: z.string(),
  status: DocStatus,
  statusLabel: z.string(),
  fileName: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  action: z.string(),
});
export type DealerDocumentDto = z.infer<typeof DealerDocumentDto>;

export const DealerDocumentsResponse = z.object({
  data: z.array(DealerDocumentDto),
  allVerified: z.boolean(),
});
export type DealerDocumentsResponse = z.infer<typeof DealerDocumentsResponse>;

/**
 * The upload rules, in one place because both ends enforce them: the browser
 * checks them for the message, the presign signature bakes them in for real.
 *
 * 5 MB, and PDF, JPEG or PNG. A KYC document is a scan or a photo of a
 * certificate — anything larger is a misunderstanding rather than a need.
 */
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const DocumentPresignInput = z
  .object({
    type: DealerDocType,
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(DOCUMENT_MIME_TYPES),
    bytes: z.number().int().min(1).max(DOCUMENT_MAX_BYTES),
  })
  .strict();
export type DocumentPresignInput = z.infer<typeof DocumentPresignInput>;

export const DocumentCommitInput = z.object({ documentId: Uuid }).strict();
export type DocumentCommitInput = z.infer<typeof DocumentCommitInput>;

export const DocTypeParam = z.object({ type: DealerDocType }).strict();
export type DocTypeParam = z.infer<typeof DocTypeParam>;

/**
 * The yard photograph — the hero of the dealership's public portfolio.
 *
 * It is not a KYC document, and it deliberately does not travel with them. The
 * three KYC documents are private, have no public delivery route and exist to
 * be checked once; this image is the first thing a buyer will ever see of the
 * dealership. Same presign → PUT → commit pipeline, different prefix,
 * different destiny.
 *
 * It lands on `dealer.coverMediaId` — the cover slot the profile already
 * carries — rather than on a column of its own, because that is exactly what
 * a cover image is.
 */
export const YARD_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const YARD_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const YardPhotoPresignInput = z
  .object({
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(YARD_PHOTO_MIME_TYPES),
    bytes: z.number().int().min(1).max(YARD_PHOTO_MAX_BYTES),
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();
export type YardPhotoPresignInput = z.infer<typeof YardPhotoPresignInput>;

export const YardPhotoCommitInput = z.object({ mediaId: Uuid }).strict();
export type YardPhotoCommitInput = z.infer<typeof YardPhotoCommitInput>;

/**
 * `url` is a short-lived signed read rather than a delivery URL. The derivative
 * pipeline that content-addresses an image and gives it a permanent public URL
 * is **F034**; until it exists the only honest way to show the dealer what they
 * uploaded is to sign a read of the original object.
 */
export const YardPhotoDto = z.object({
  mediaId: Uuid.nullable(),
  status: MediaStatus.nullable(),
  fileName: z.string().nullable(),
  url: z.string().nullable(),
  uploadedAt: z.string().nullable(),
});
export type YardPhotoDto = z.infer<typeof YardPhotoDto>;

export const VehicleMediaDto = z.object({
  mediaId: Uuid,
  position: z.number().int(),
  isPrimary: z.boolean(),
  status: MediaStatus,
  url: z.string().nullable(),
  blurhash: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fileName: z.string().nullable(),
  warnings: z.array(z.string()),
  uploadedByAdmin: z.boolean(),
});
export type VehicleMediaDto = z.infer<typeof VehicleMediaDto>;

// ─────────── C14 media ─────────────────────────────────────────────────────
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const MediaPresignInput = z
  .object({
    ownerType: z.enum(['VEHICLE', 'DEALER_LOGO', 'DEALER_COVER']),
    ownerId: Uuid,
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    bytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();
export type MediaPresignInput = z.infer<typeof MediaPresignInput>;

export const MediaCommitInput = z
  .object({ position: z.number().int().min(0).max(40).optional() })
  .strict();
export type MediaCommitInput = z.infer<typeof MediaCommitInput>;

export const MediaCommitResponse = z.object({
  mediaId: Uuid,
  status: MediaStatus,
  position: z.number().int(),
  poll: z.string(),
  estimatedSeconds: z.number().int(),
});
export type MediaCommitResponse = z.infer<typeof MediaCommitResponse>;
