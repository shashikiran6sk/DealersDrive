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
  reserve: {
    code: 'LISTING_NOT_RESERVABLE',
    message: 'Only a car that is on sale can be reserved.',
  },
  reactivate: {
    code: 'LISTING_NOT_RESERVED',
    message: 'Only a reserved car can be put back on sale.',
  },
  markSold: {
    code: 'LISTING_NOT_SELLABLE',
    message: 'Only a car that is on sale or reserved can be marked sold.',
  },
  withdraw: {
    code: 'LISTING_NOT_WITHDRAWABLE',
    message: 'Only a car that is on sale can be withdrawn.',
  },
  relist: {
    code: 'LISTING_NOT_RELISTABLE',
    message: 'Only a withdrawn listing can be relisted.',
  },
} as const;

export const REASON_REQUIRED = 'A reason is required for this decision.';

export const WITHDRAWAL_REASON_REQUIRED = 'Choose why the listing is being withdrawn.';

export const REACTIVATION_NOT_ALLOWED = {
  code: 'LISTING_NOT_REACTIVATABLE',
  message: 'Only a reserved or withdrawn car can be put back on sale.',
} as const;

export const REACTIVATION_ALREADY_PENDING =
  'A request to put this car back on sale is already waiting for review.';

export const REACTIVATION_NOT_FOUND = 'That reactivation request does not exist.';

export const REACTIVATION_NOT_PENDING = 'That reactivation request has already been decided.';

export const REACTIVATION_STALE =
  'The listing has changed since this request was made, so it cannot be approved.';
