import {
  DEALER_ROLE_LABELS,
  formatDate,
  formatPhone,
  initialsOf,
  type InvitationStatus,
  type MyInvitation,
  type TeamInvitation,
  type TeamMember,
} from '@dealers-drive/contracts';
import type { Dealer, DealerInvitation, DealerMember, User } from '@prisma/client';

import { UNNAMED_MEMBER } from '../../platform/messages.js';

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Waiting for sign-in',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  REVOKED: 'Withdrawn',
  EXPIRED: 'Expired',
};

const ROLE_ORDER = { OWNER: 0, MANAGER: 1, STAFF: 2 } as const;

export type MemberRow = DealerMember & { user: User };

export function effectiveStatus(
  invitation: Pick<DealerInvitation, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): InvitationStatus {
  return invitation.status === 'PENDING' && invitation.expiresAt <= now
    ? 'EXPIRED'
    : invitation.status;
}

export function byRoleThenJoined(a: MemberRow, b: MemberRow): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.getTime() - b.createdAt.getTime();
}

export function toTeamMember(row: MemberRow, viewerId: string): TeamMember {
  const name = row.user.fullName?.trim() || UNNAMED_MEMBER;
  return {
    id: row.id,
    name,
    initials: initialsOf(name),
    phoneDisplay: row.user.phone ? formatPhone(row.user.phone) : null,
    email: row.user.email,
    role: row.role,
    roleLabel: DEALER_ROLE_LABELS[row.role],
    joinedAt: row.createdAt.toISOString(),
    joinedLabel: formatDate(row.createdAt),
    isYou: row.userId === viewerId,
    manageable: row.role !== 'OWNER',
  };
}

export function toTeamInvitation(row: DealerInvitation, now: Date = new Date()): TeamInvitation {
  const status = effectiveStatus(row, now);
  return {
    id: row.id,
    phoneDisplay: formatPhone(row.phone),
    role: row.role,
    roleLabel: DEALER_ROLE_LABELS[row.role],
    status,
    statusLabel: INVITATION_STATUS_LABELS[status],
    invitedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    expiresLabel: formatDate(row.expiresAt),
  };
}

export function toMyInvitation(
  row: DealerInvitation & { dealer: Pick<Dealer, 'brandName' | 'city'> },
  invitedByName: string | null,
): MyInvitation {
  return {
    id: row.id,
    dealer: { brandName: row.dealer.brandName, city: row.dealer.city },
    role: row.role,
    roleLabel: DEALER_ROLE_LABELS[row.role],
    invitedByName,
    expiresAt: row.expiresAt.toISOString(),
    expiresLabel: formatDate(row.expiresAt),
  };
}
