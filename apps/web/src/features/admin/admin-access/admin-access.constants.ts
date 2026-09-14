import type { AdminAccessEntry } from '@dealers-drive/contracts';

export const ROLE_LABELS: Record<AdminAccessEntry['adminRole'], string> = {
  SUPPORT: 'Support',
  MODERATOR: 'Moderator',
  SUPER_ADMIN: 'Super admin',
};

export const ROLE_OPTIONS: { value: AdminAccessEntry['adminRole']; label: string }[] = [
  { value: 'SUPPORT', label: 'Support — read only' },
  { value: 'MODERATOR', label: 'Moderator — review and decide' },
  { value: 'SUPER_ADMIN', label: 'Super admin — everything' },
];

export const DEFAULT_ADMIN_ROLE = 'MODERATOR';

export const ADMIN_ACCESS_TEXT = {
  heading: 'Admin access',
  intro:
    'Everyone who can open this console. A granted address takes effect on their next sign-in — they still sign in with Google, and the address here has to be the one Google knows them by. Every grant and withdrawal is written to the audit trail.',
  emailLabel: 'Email address',
  emailHint: 'the Google account',
  emailPlaceholder: 'name@example.com',
  roleLabel: 'Role',
  grant: 'Grant access',
  withdraw: 'Withdraw',
  you: 'You',
  grantFailed: 'We could not grant that access.',
  revokeFailed: 'We could not withdraw that access.',
  granted: (email: string) => `${email} can now open the admin console.`,
  grantedBy: (email: string) => `by ${email}`,
  caption: 'Everyone who can open the admin console',
} as const;

export const ADMIN_ACCESS_COLUMNS = [
  { key: 'who', label: 'Operator' },
  { key: 'role', label: 'Role' },
  { key: 'source', label: 'Access' },
  { key: 'seen', label: 'Last signed in' },
  { key: 'action', label: '', align: 'right' },
] as const;
