import type { DealerTeamResponse, TeamInvitation, TeamMember } from '@dealers-drive/contracts';

import type { TeamActionResult } from '@/features/dealer/team-actions';

export interface TeamPanelProps {
  team: DealerTeamResponse;
}

export interface MemberCardProps {
  member: TeamMember;
  pending: boolean;
  onChangeRole: (memberId: string, role: string) => void;
  onRemove: (memberId: string) => Promise<TeamActionResult>;
}

export interface InvitationCardProps {
  invitation: TeamInvitation;
  pending: boolean;
  onWithdraw: (invitationId: string) => void;
}

export interface InviteMemberDialogProps {
  onInvite: (phone: string, role: string) => Promise<TeamActionResult>;
}
