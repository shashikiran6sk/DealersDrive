import {
  ASSIGNABLE_DEALER_ROLES,
  DEALER_ROLE_LABELS,
  INVITATION_TTL_DAYS,
} from '@dealers-drive/contracts';

export const TEAM_TEXT = {
  title: 'Team',
  intro: 'The people who work this dealership. Only you, as the owner, can change who is here.',
  count: (members: number) => (members === 1 ? '1 member' : `${String(members)} members`),
  membersHeading: 'Members',
  membersLabel: 'Team members',
  invitationsHeading: 'Invitations waiting',
  invitationsLabel: 'Invitations waiting for sign-in',
  invitationsHint: `An invitation waits ${String(INVITATION_TTL_DAYS)} days for the number to sign in to Dealers-Drive. Nothing is sent — tell them to sign in with that number.`,
  noInvitations: 'No invitations waiting.',
  you: 'You',
  owner: 'Owner',
  joined: (label: string) => `Joined ${label}`,
  expires: (label: string) => `Until ${label}`,
  invite: 'Invite member',
  inviteTitle: 'Invite a member',
  inviteDescription:
    'They sign in to Dealers-Drive with this mobile number — as a customer, with the usual OTP — and accept from their account menu.',
  phoneLabel: 'Mobile number',
  phoneHint: '+91',
  phonePlaceholder: '98400 12345',
  roleLabel: 'Role',
  sendInvite: 'Invite',
  cancel: 'Cancel',
  roleSelectLabel: (name: string) => `Role for ${name}`,
  remove: 'Remove',
  removeTitle: (name: string) => `Remove ${name}?`,
  removeDescription:
    'They lose this dealership straight away. Their own Dealers-Drive account stays as it is, and you can invite them again later.',
  removeConfirm: 'Remove from team',
  withdraw: 'Withdraw',
  withdrawLabel: (phone: string) => `Withdraw the invitation to ${phone}`,
  invited: (phone: string) => `Invitation saved for ${phone}.`,
} as const;

export const ROLE_OPTIONS = ASSIGNABLE_DEALER_ROLES.map((role) => ({
  value: role,
  label: DEALER_ROLE_LABELS[role],
}));

export const ROLE_DESCRIPTIONS: Record<(typeof ASSIGNABLE_DEALER_ROLES)[number], string> = {
  MANAGER: 'Runs stock and leads: submits cars, marks them reserved or sold, closes enquiries.',
  STAFF: 'Prepares drafts and calls buyers back: adds and edits drafts, marks enquiries contacted.',
};

export const DEFAULT_INVITE_ROLE = 'STAFF';
