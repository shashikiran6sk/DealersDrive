import type { AdminMemberStatus, AdminRole, StatusTone } from '@dealers-drive/contracts';

export const ROLE_OPTIONS: readonly { value: AdminRole; label: string }[] = [
  { value: 'SALES_REP', label: 'Sales representative — assisted onboarding only' },
  { value: 'SUPPORT', label: 'Support — read, and work support tickets' },
  { value: 'MODERATOR', label: 'Operations — review and decide' },
  { value: 'SUPER_ADMIN', label: 'Super admin — everything, including members' },
];

export const STATUS_TONE: Readonly<Record<AdminMemberStatus, StatusTone>> = {
  ACTIVE: 'ok',
  INVITED: 'warn',
  DISABLED: 'neutral',
};

export const STATUS_TABS: readonly { key: 'ALL' | AdminMemberStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INVITED', label: 'Invited' },
  { key: 'DISABLED', label: 'Disabled' },
];

export const MEMBER_COLUMNS = [
  { key: 'who', label: 'Member' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'seen', label: 'Last signed in' },
  { key: 'action', label: '', align: 'right' },
] as const;

export const MEMBERS_TEXT = {
  heading: 'Members',
  intro:
    'Everyone on the Dealers-Drive team who can sign in to the admin console or the Sales workspace. Each person signs in with their own Google account; this list decides what they may do. Every change is written to the audit trail.',
  inviteHeading: 'Invite a team member',
  emailLabel: 'Google email address',
  emailHint: 'the account they will sign in with',
  emailPlaceholder: 'name@example.com',
  nameLabel: 'Name',
  nameHint: 'optional',
  roleLabel: 'Role',
  invite: 'Send invite',
  invited: (email: string) =>
    `${email} is invited. They can sign in at /admin/login with that Google account.`,
  tabsLabel: 'Filter members by status',
  caption: 'Internal team members',
  empty: 'No team members match this filter.',
  you: 'You',
  roleFor: (email: string) => `Role for ${email}`,
  disable: 'Disable',
  reactivate: 'Re-activate',
  history: 'History',
  invitedBy: (email: string) => `invited by ${email}`,
  disabledBecause: (reason: string) => `Disabled: ${reason}`,
  disableTitle: (email: string) => `Disable ${email}?`,
  disableBody:
    'They are signed out of the admin console and the Sales workspace straight away, and cannot sign in again until re-activated. Their history stays.',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'e.g. Left the company on 6 October',
  confirmDisable: 'Disable member',
  cancel: 'Cancel',
  saved: 'Saved.',
} as const;

export const MIN_REASON = 3;

export const MEMBER_DETAIL_TEXT = {
  back: '← All members',
  email: 'Google account',
  role: 'Role',
  lastSignIn: 'Last signed in',
  disabledReason: 'Disabled because',
  historyHeading: 'History',
  noHistory: 'Nothing recorded yet.',
} as const;
