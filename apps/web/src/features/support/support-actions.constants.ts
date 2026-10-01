export const SUPPORT_ACTION_TEXT = {
  invalid: 'Check the highlighted fields and try again.',
  failed: 'We could not send that just now. Try again in a moment.',
  unavailable: 'Dealers-Drive is not reachable right now. Try again in a moment.',
  listPath: '/support-requests',
  detailPath: (id: string) => `/support-requests/${id}`,
} as const;
