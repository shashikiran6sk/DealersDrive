export const LISTING_STATE_CHANGED =
  'This listing changed while you were looking at it. Reload it and try again.';

export const LISTING_NOT_FOUND = 'That listing does not exist.';

export const TRANSITION_REFUSALS = {
  submit: {
    code: 'LISTING_NOT_SUBMITTABLE',
    message: 'Only a draft can be submitted for review.',
  },
  resubmit: {
    code: 'LISTING_NOT_SUBMITTABLE',
    message: 'Only a listing sent back for changes can be resubmitted.',
  },
  requestChanges: {
    code: 'LISTING_NOT_REVIEWABLE',
    message: 'Changes can only be requested on a listing waiting for review.',
  },
  reject: {
    code: 'LISTING_NOT_REVIEWABLE',
    message: 'Only a listing waiting for review can be rejected.',
  },
  approve: {
    code: 'LISTING_NOT_APPROVABLE',
    message: 'Only a listing waiting for review can be approved.',
  },
  markSold: {
    code: 'LISTING_NOT_SELLABLE',
    message: 'Only a live listing can be marked sold.',
  },
  remove: {
    code: 'LISTING_NOT_REMOVABLE',
    message: 'Only a live listing can be taken off the marketplace.',
  },
} as const;

export const REASON_REQUIRED = 'A reason is required for this decision.';
