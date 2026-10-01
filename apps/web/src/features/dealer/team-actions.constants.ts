export const TEAM_ACTION_TEXT = {
  teamPath: '/dealer/team',
  invalid: 'That does not look right. Check the number and the role, then try again.',
  failed: 'That could not be saved. Please try again.',
  unavailable: 'Dealers-Drive could not be reached. Check your connection and try again.',
} as const;

export const TEAM_PATHS = {
  invitations: '/v1/dealer/team/invitations',
  invitation: (id: string) => `/v1/dealer/team/invitations/${encodeURIComponent(id)}`,
  member: (id: string) => `/v1/dealer/team/members/${encodeURIComponent(id)}`,
} as const;
