export const ADMIN_SUPPORT_ACTION_TEXT = {
  invalid: 'Check what you entered and try again.',
  failed: 'That change could not be saved. Try again.',
  unavailable: 'The admin API is not reachable right now. Try again in a moment.',
  listPath: '/admin/support',
  detailPath: (id: string) => `/admin/support/${id}`,
} as const;
