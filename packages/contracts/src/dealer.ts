import { z } from 'zod';

import { Uuid } from './common.js';
import { DealerDocType, DocStatus, MediaStatus } from './enums.js';

/**
 * PART C — the dealer console (API-SPEC C1–C20). Every shape here is read or
 * written by somebody holding a `DealerPrincipal`, which is why not one of them
 * names a `dealerId`: that comes from the session (CLAUDE.md rule 1).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~800 lines covering the dealership profile, onboarding,
 * KYC documents, the vehicle wizard, RC lookup, inventory, media and enquiries.
 * Each shape arrives with the feature that first sends or answers with it; the
 * C14 media block below is here because **F033** is, and the C5 KYC read
 * shapes because **F040** is.
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

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `DOCUMENT_MIME_TYPES`, `DOCUMENT_MAX_BYTES`, `DocumentPresignInput`,
 * `DocumentCommitInput` and `DocTypeParam` sit here in the baseline. They are
 * the *write* half of C5, and they arrive with **F041** — the upload step that
 * sends them. F040 is the model and the read.
 * ────────────────────────────────────────────────────────────────────────────
 */

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
