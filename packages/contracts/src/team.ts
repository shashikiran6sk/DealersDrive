import { z } from 'zod';

import { IndianMobile, Uuid } from './common.js';
import { ASSIGNABLE_DEALER_ROLES } from './dealer-access.js';
import { DealerRole } from './enums.js';

/**
 * ── R94 · a dealership's team ──────────────────────────────────────────────
 *
 * An OWNER invites a mobile number as MANAGER or STAFF. The invitation is held
 * against the number, not against an account, so it reaches somebody who has
 * never used Dealers-Drive as well as somebody who has: whoever next proves
 * that number with the ordinary customer sign-in sees it and may accept.
 *
 * Nothing is sent. There is no link and no token, so there is nothing to
 * forward, guess or replay — the proof is the OTP the person already completes
 * to sign in, and acceptance checks the invitation's number against the
 * session's verified number on the server.
 */
export const InvitationStatus = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']);
export type InvitationStatus = z.infer<typeof InvitationStatus>;

export const AssignableDealerRole = z.enum(ASSIGNABLE_DEALER_ROLES);
export type AssignableDealerRole = z.infer<typeof AssignableDealerRole>;

/** How long an invitation waits for its number to sign in. */
export const INVITATION_TTL_DAYS = 7;

export const TeamMember = z.object({
  id: Uuid,
  name: z.string(),
  initials: z.string(),
  phoneDisplay: z.string().nullable(),
  email: z.string().nullable(),
  role: DealerRole,
  roleLabel: z.string(),
  joinedAt: z.string(),
  joinedLabel: z.string(),
  isYou: z.boolean(),
  /** False for the OWNER in V1: the owner can be neither demoted nor removed. */
  manageable: z.boolean(),
});
export type TeamMember = z.infer<typeof TeamMember>;

export const TeamInvitation = z.object({
  id: Uuid,
  phoneDisplay: z.string(),
  role: DealerRole,
  roleLabel: z.string(),
  status: InvitationStatus,
  statusLabel: z.string(),
  invitedAt: z.string(),
  expiresAt: z.string(),
  expiresLabel: z.string(),
});
export type TeamInvitation = z.infer<typeof TeamInvitation>;

export const DealerTeamResponse = z.object({
  members: z.array(TeamMember),
  invitations: z.array(TeamInvitation),
});
export type DealerTeamResponse = z.infer<typeof DealerTeamResponse>;

/** `POST /v1/dealer/team/invitations`. Inviting a number already invited re-sends it. */
export const InviteMemberInput = z
  .object({ phone: IndianMobile, role: AssignableDealerRole })
  .strict();
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;

/** `PATCH /v1/dealer/team/members/:id`. OWNER is not a role an owner can hand out. */
export const UpdateMemberInput = z.object({ role: AssignableDealerRole }).strict();
export type UpdateMemberInput = z.infer<typeof UpdateMemberInput>;

/** An invitation as the invited person sees it, at `GET /v1/invitations`. */
export const MyInvitation = z.object({
  id: Uuid,
  dealer: z.object({ brandName: z.string(), city: z.string().nullable() }),
  role: DealerRole,
  roleLabel: z.string(),
  invitedByName: z.string().nullable(),
  expiresAt: z.string(),
  expiresLabel: z.string(),
});
export type MyInvitation = z.infer<typeof MyInvitation>;

export const MyInvitationsResponse = z.object({ data: z.array(MyInvitation) });
export type MyInvitationsResponse = z.infer<typeof MyInvitationsResponse>;

/** What accepting answers: the new membership, ready to enter. */
export const AcceptInvitationResponse = z.object({
  membershipId: Uuid,
  dealer: z.object({ brandName: z.string() }),
  role: DealerRole,
  roleLabel: z.string(),
});
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponse>;
