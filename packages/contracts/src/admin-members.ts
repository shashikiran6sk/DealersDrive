import { z } from 'zod';

import { Uuid } from './common.js';
import { AdminMemberStatus, AdminRole } from './enums.js';

/**
 * ── Admin Members — the Super admin's management surface ───────────────────
 *
 * One row per internal team member. `source: BOOTSTRAP` is an address on
 * `ADMIN_ALLOWLIST`: the deployment admits it, so it cannot be re-roled or
 * disabled here. Every other member is managed on this screen, and every
 * change is written to the audit trail with the exact member who made it.
 */
export const AdminMemberDto = z.object({
  id: Uuid,
  userId: Uuid,
  name: z.string().nullable(),
  email: z.string(),
  role: AdminRole,
  roleLabel: z.string(),
  status: AdminMemberStatus,
  statusLabel: z.string(),
  source: z.enum(['BOOTSTRAP', 'INVITED']),
  invitedByEmail: z.string().nullable(),
  invitedAt: z.string(),
  activatedAt: z.string().nullable(),
  lastLoginLabel: z.string(),
  disabledAt: z.string().nullable(),
  disabledReason: z.string().nullable(),
  isYou: z.boolean(),
  /** Why the controls are absent on this row, shown in their place. Null when they are not. */
  lockedReason: z.string().nullable(),
});
export type AdminMemberDto = z.infer<typeof AdminMemberDto>;

export const AdminMembersQuery = z
  .object({
    status: AdminMemberStatus.optional(),
    role: AdminRole.optional(),
  })
  .strict();
export type AdminMembersQuery = z.infer<typeof AdminMembersQuery>;

export const AdminMembersResponse = z.object({
  data: z.array(AdminMemberDto),
  counts: z.object({
    ALL: z.number().int(),
    INVITED: z.number().int(),
    ACTIVE: z.number().int(),
    DISABLED: z.number().int(),
  }),
});
export type AdminMembersResponse = z.infer<typeof AdminMembersResponse>;

/**
 * Add a team member. The address is the Google account they will sign in
 * with, normalised by the schema on both sides of the wire. There is no role
 * default: the inviter chooses, so nobody is made a Super admin by accident.
 */
export const InviteAdminMemberInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(160),
    name: z.string().trim().min(1).max(120).optional(),
    role: AdminRole,
  })
  .strict();
export type InviteAdminMemberInput = z.infer<typeof InviteAdminMemberInput>;

export const UpdateAdminMemberInput = z.object({ role: AdminRole }).strict();
export type UpdateAdminMemberInput = z.infer<typeof UpdateAdminMemberInput>;

export const DisableAdminMemberInput = z
  .object({ reason: z.string().trim().min(3).max(300) })
  .strict();
export type DisableAdminMemberInput = z.infer<typeof DisableAdminMemberInput>;

export const AdminMemberHistoryEntry = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  actorEmail: z.string().nullable(),
  detail: z.string().nullable(),
  at: z.string(),
});
export type AdminMemberHistoryEntry = z.infer<typeof AdminMemberHistoryEntry>;

export const AdminMemberHistoryResponse = z.object({
  member: AdminMemberDto,
  history: z.array(AdminMemberHistoryEntry),
});
export type AdminMemberHistoryResponse = z.infer<typeof AdminMemberHistoryResponse>;

export const ADMIN_MEMBER_STATUS_LABELS: Readonly<Record<AdminMemberStatus, string>> = {
  INVITED: 'Invited',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
};
