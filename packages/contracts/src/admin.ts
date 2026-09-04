import { z } from 'zod';

import { AdminRole, DocStatus, StatusTone } from './enums.js';

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
 * shell reads, and the D5 review shapes because **F044** does.
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
