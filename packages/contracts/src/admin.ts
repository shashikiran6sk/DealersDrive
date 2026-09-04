import { z } from 'zod';

import { AdminRole, StatusTone } from './enums.js';

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
 * shell reads.
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
