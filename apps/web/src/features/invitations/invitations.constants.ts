export const INVITATIONS_TEXT = {
  title: 'Dealership invitations',
  intro:
    'A dealership on Dealers-Drive has invited your mobile number to join its team. Accept to work in its dealer console with this same account.',
  listLabel: 'Invitations',
  emptyTitle: 'No invitations waiting',
  emptyMessage: 'When a dealership invites your number, it appears here the next time you sign in.',
  invitedAs: (role: string) => `Invited as ${role}`,
  invitedBy: (name: string) => `by ${name}`,
  until: (label: string) => `Open until ${label}`,
  accept: 'Accept and open dealer dashboard',
  decline: 'Decline',
  failed: 'That could not be done. Please try again.',
  unavailable: 'Dealers-Drive could not be reached. Check your connection and try again.',
  path: '/invitations',
  loginPath: '/login?returnTo=%2Finvitations',
} as const;

export const INVITATION_PATHS = {
  mine: '/v1/invitations',
  accept: (id: string) => `/v1/invitations/${encodeURIComponent(id)}/accept`,
  decline: (id: string) => `/v1/invitations/${encodeURIComponent(id)}/decline`,
} as const;
