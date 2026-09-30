import {
  WITHDRAWAL_REASON_LABELS,
  WithdrawalReason,
  type ListingLifecycleAction,
} from '@dealers-drive/contracts';

import type { LifecycleMove } from './listing-lifecycle.types';

export const LIFECYCLE_PATHS: Record<ListingLifecycleAction, string> = {
  reserve: 'reserve',
  markSold: 'mark-sold',
  withdraw: 'withdraw',
  requestReactivation: 'request-reactivation',
};

export const LIFECYCLE_MOVES: Record<ListingLifecycleAction, LifecycleMove> = {
  reserve: {
    label: 'Mark reserved',
    title: 'Reserve this vehicle?',
    description:
      'The listing will remain visible but customers will not be able to open or enquire about it. Putting it back on sale needs Dealers Drive’s approval.',
    confirm: 'Reserve vehicle',
    tone: 'primary',
  },
  markSold: {
    label: 'Mark sold',
    title: 'Mark this vehicle as sold?',
    description:
      'It will be removed from public listings and search. A sold vehicle cannot be put back on sale.',
    confirm: 'Mark sold',
    tone: 'primary',
  },
  withdraw: {
    label: 'Withdraw',
    title: 'Withdraw this listing?',
    description:
      'It will be removed from public listings. To put it back on sale later, request reactivation — Dealers Drive reviews every request.',
    confirm: 'Withdraw listing',
    tone: 'danger',
  },
  requestReactivation: {
    label: 'Request reactivation',
    title: 'Ask to put this vehicle back on sale?',
    description:
      'Dealers Drive reviews every request. The listing stays as it is until an admin approves it, then goes back on the marketplace with the same photographs and details.',
    confirm: 'Send request',
    tone: 'primary',
  },
};

export const WITHDRAWAL_REASON_OPTIONS = WithdrawalReason.options.map((value) => ({
  value,
  label: WITHDRAWAL_REASON_LABELS[value],
}));

export const WITHDRAWAL_NOTE_MAX = 500;

export const REACTIVATION_REASON_MAX = 500;

export const LIFECYCLE_TEXT = {
  groupLabel: (title: string) => `Change the listing status of ${title}`,
  cancel: 'Cancel',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Choose a reason',
  noteLabel: 'Note',
  noteHint: 'Optional — only your dealership sees it',
  reasonRequired: 'Choose why you are withdrawing the listing.',
  invalid: 'That change could not be made. Reload the page and try again.',
  failed: 'The listing could not be updated. Try again.',
  unavailable: 'The API is unavailable. Try again shortly.',
  withdrawnReason: 'Reason:',
  withdrawnNote: 'Your note:',
  reactivationPending: 'Reactivation pending approval',
  reactivationReasonLabel: 'Note for the reviewer',
  reactivationReasonHint: 'Optional — for example, why the car is available again',
  reactivationDeclined: 'Reactivation declined:',
  reactivationNoNote: 'No reason given.',
  viewOnSite: 'View on site',
  listingHeading: 'On the marketplace',
} as const;

export const INVENTORY_PATH = '/dealer/inventory';

export const DASHBOARD_PATH = '/dealer';

export function vehicleEditPath(vehicleId: string): string {
  return `/dealer/vehicles/${vehicleId}/edit`;
}
