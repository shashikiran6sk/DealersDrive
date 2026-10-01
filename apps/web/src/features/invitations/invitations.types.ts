import type { MyInvitation } from '@dealers-drive/contracts';

export interface InvitationListProps {
  invitations: MyInvitation[];
}

export interface InvitationItemProps {
  invitation: MyInvitation;
}
