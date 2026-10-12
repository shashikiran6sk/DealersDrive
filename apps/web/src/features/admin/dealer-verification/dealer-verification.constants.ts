export const DEALER_VERIFICATION_TEXT = {
  heading: 'Dealer verification',
  intro:
    'Dealer Verified is a badge on top of approval. It needs an approved dealership, verified contact details and both identity documents verified — checked when you save. Yard photographs play no part.',
  verifiedOn: (date: string) => `Verified ${date}`,
  nextStatus: 'Next verification status',
  reason: 'Decision reason',
  save: 'Save verification decision',
  historyHeading: 'Verification history',
  historyNote: 'Latest 100 decisions. Full history is retained in the restricted audit log.',
  noHistory: 'No verification decisions recorded.',
  actor: (actorId: string | null) => `Administrator ${actorId ?? 'System'}`,
  invalidDealer: 'Invalid dealership.',
  invalidDecision: 'Check the verification decision.',
  saveFailed: 'Could not save the verification decision.',
  unavailable: 'Verification service is unavailable.',
} as const;

export const REASON_REQUIRED_STATUSES = ['REJECTED', 'REVOKED'] as const;
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 2000;
export const DATE_LOCALE = 'en-IN';
