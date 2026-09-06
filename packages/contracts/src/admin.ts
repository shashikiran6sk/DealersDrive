import { z } from 'zod';

import { CursorPage, Uuid } from './common.js';
import { AdminRole, DealerDocType, DealerStatus, DocStatus, StatusTone } from './enums.js';

/**
 * PART D — the admin API (API-SPEC D1–D17). Every write here is audit-logged
 * with the admin's identity, and every cross-tenant read is a deliberate,
 * auditable choice rather than an accident (ARCHITECTURE §7).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~520 lines covering metrics, dealers, the moderation
 * queue, payments, configuration and the audit log. Each shape arrives with the
 * feature that first answers with it; `AdminOverview` is here because **F049**
 * serves it from `GET /v1/admin/metrics/overview`, which is what the console
 * shell reads, the D5 review shapes because **F044** does, and the D2–D4 dealer
 * shapes because **F045** does.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─────────── D1 metrics ────────────────────────────────────────────────────
export const AdminOverview = z.object({
  stats: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number().int(),
      valueLabel: z.string(),
      href: z.string().optional(),
    }),
  ),
  moderationQueue: z.object({
    pendingCount: z.number().int(),
    oldestWaitingLabel: z.string(),
    message: z.string(),
    href: z.string(),
  }),
  headerBadge: z.object({
    count: z.number().int(),
    label: z.string(),
    tone: StatusTone,
  }),
  /**
   * Who is signed in, for the console's top bar (DESIGN-SPEC §3.17). It comes
   * from the session, so the header cannot show one operator while the audit
   * log records another.
   */
  operator: z.object({ email: z.string(), adminRole: AdminRole }),
});
export type AdminOverview = z.infer<typeof AdminOverview>;

// ─────────── D2/D3 dealers ─────────────────────────────────────────────────
export const AdminDealerQuery = z
  .object({
    status: DealerStatus.optional(),
    /**
     * The city as it is written on the dealership, not as a slug.
     *
     * It was a slug because the filter joined `cities`; with the table gone
     * the column is the city's name, and the console filters on it directly.
     * The match is case-insensitive, so a link built from one dealer's
     * `Vellore` still finds another's `vellore`.
     */
    city: z.string().trim().min(1).max(80).optional(),
    /**
     * District and state, the other two halves of "where".
     *
     * The three are `AND`ed rather than treated as one place field, because
     * that is how the questions arrive: every dealer in Tamil Nadu, every
     * dealer in Vellore district, or one town inside it. Each is matched
     * case-insensitively against the dealership's own text for the same reason
     * `city` is — the values in the column were typed by dealers.
     */
    district: z.string().trim().min(1).max(80).optional(),
    state: z.string().trim().min(1).max(80).optional(),
    q: z.string().max(120).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AdminDealerQuery = z.infer<typeof AdminDealerQuery>;

export const AdminDealerRow = z.object({
  id: Uuid,
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  district: z.string(),
  state: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  vehicleCount: z.number().int(),
  activeCount: z.number().int(),
  joinedAt: z.string(),
  joinedLabel: z.string(),
  creditBalance: z.number().int(),
  documentsVerified: z.boolean(),
});
export type AdminDealerRow = z.infer<typeof AdminDealerRow>;

/**
 * The values the location filters can actually take, computed from the rows
 * that exist.
 *
 * They ship with the list for the same reason `counts` does: a filter offering
 * a district nobody trades in, or missing the one that was typed yesterday, is
 * a filter that has to be kept in step by hand. These are distinct values off
 * the `dealers` table, so the console can only ever offer a filter that matches
 * something.
 */
export const AdminDealerFacets = z.object({
  cities: z.array(z.string()),
  districts: z.array(z.string()),
  states: z.array(z.string()),
});
export type AdminDealerFacets = z.infer<typeof AdminDealerFacets>;

export const AdminDealersResponse = z.object({
  data: z.array(AdminDealerRow),
  page: CursorPage,
  counts: z.record(z.string(), z.number().int()),
  facets: AdminDealerFacets,
});
export type AdminDealersResponse = z.infer<typeof AdminDealersResponse>;

export const AdminDealerDocument = z.object({
  id: Uuid,
  type: DealerDocType,
  label: z.string(),
  status: DocStatus,
  fileName: z.string().nullable(),
  bytes: z.number().int().nullable(),
  uploadedAt: z.string().nullable(),
  /** Short-lived, audit-logged, and the only way a document is ever read. */
  viewUrl: z.string().nullable(),
  viewUrlExpiresAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});
export type AdminDealerDocument = z.infer<typeof AdminDealerDocument>;

export const AdminDealerDetail = z.object({
  id: Uuid,
  slug: z.string(),
  brandName: z.string(),
  legalName: z.string(),
  initials: z.string(),
  status: DealerStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  statusReason: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  state: z.string().nullable(),
  addressLine: z.string().nullable(),
  /**
   * The dealer's Google Maps link, for the reviewer.
   *
   * KYC is partly a question about a place — is there a yard at this address —
   * and the pin the dealer dropped is better evidence than the address string
   * they typed. It sits beside the yard photograph for that reason.
   */
  mapsUrl: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactPhoneDisplay: z.string().nullable(),
  contactEmail: z.string().nullable(),
  joinedLabel: z.string(),
  creditBalance: z.number().int(),
  creditsHeld: z.number().int(),
  counts: z.object({
    vehicles: z.number().int(),
    active: z.number().int(),
    pending: z.number().int(),
    enquiries: z.number().int(),
  }),
  documents: z.array(AdminDealerDocument),
  allDocumentsVerified: z.boolean(),
  /**
   * The yard photograph, as a short-lived signed read. A reviewer has to be
   * able to see it: it is the image that will front this dealership's public
   * portfolio, and "is this actually a photograph of a yard" is a question only
   * a person can answer.
   */
  yardPhotoUrl: z.string().nullable(),
  recentLedger: z.array(
    z.object({
      id: Uuid,
      delta: z.number().int(),
      deltaLabel: z.string(),
      label: z.string(),
      dateLabel: z.string(),
      balanceAfter: z.number().int(),
    }),
  ),
  actions: z.object({
    canApprove: z.boolean(),
    canReject: z.boolean(),
    canSuspend: z.boolean(),
    canReinstate: z.boolean(),
    canGrantCredits: z.boolean(),
  }),
});
export type AdminDealerDetail = z.infer<typeof AdminDealerDetail>;

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline's `ApproveDealerInput` also carries `grantCredits`, an
 * onboarding bonus seeded in the same transaction as the approval. It is not
 * here, and that is deliberate rather than an oversight: rule 4 says every
 * credit movement writes a `CreditTransaction` through `moveCredits`, and
 * neither the model nor the facade exists until **F050**. Accepting the field
 * and quietly not moving anything is exactly what that rule exists to prevent —
 * so with the schema `.strict()`, sending it is a named 400 instead. It returns
 * with the ledger that can honour it.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const ApproveDealerInput = z
  .object({ note: z.string().trim().max(300).optional() })
  .strict();
export type ApproveDealerInput = z.infer<typeof ApproveDealerInput>;

export const NoteInput = z.object({ note: z.string().trim().max(500).optional() }).strict();
export type NoteInput = z.infer<typeof NoteInput>;

export const DealerModerationResponse = z.object({
  id: Uuid,
  status: DealerStatus,
  statusLabel: z.string(),
  creditsGranted: z.number().int(),
  creditBalance: z.number().int(),
  listingsAffected: z.number().int(),
  notifiedAt: z.string(),
});
export type DealerModerationResponse = z.infer<typeof DealerModerationResponse>;

// ─────────── D4/D5 moderation input ────────────────────────────────────────
/** Six characters is what the dialog's disabled confirm button implies (§10). */
export const ReasonInput = z
  .object({ reason: z.string().trim().min(6, 'Give a reason of at least 6 characters.').max(500) })
  .strict();
export type ReasonInput = z.infer<typeof ReasonInput>;

/**
 * The answer to verifying or rejecting one KYC document.
 *
 * `allVerified` is the moderator's cue that this was the last one outstanding,
 * and `dealerCanBeApproved` says what that means for the decision in front of
 * them — derived here rather than in the console, so two admins looking at the
 * same dealership cannot reach different conclusions about whether it is ready.
 */
export const VerifyDocumentResponse = z.object({
  status: DocStatus,
  allVerified: z.boolean(),
  dealerCanBeApproved: z.boolean(),
});
export type VerifyDocumentResponse = z.infer<typeof VerifyDocumentResponse>;
