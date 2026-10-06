export const HISTORY_LABELS: Record<string, string> = {
  'listing.submitted': 'Submitted for review',
  'listing.resubmitted': 'Resubmitted after changes',
  'listing.changes_requested': 'Changes requested',
  'listing.rejected': 'Rejected',
  'listing.approved': 'Approved and published',
  'listing.reserved': 'Reserved for a buyer',
  'listing.reactivated': 'Back on sale after a reservation',
  'listing.marked_sold': 'Marked sold',
  'listing.withdrawn': 'Withdrawn by the dealer',
  'listing.relisted': 'Relisted',
  'listing.reactivation_requested': 'Dealer asked to put it back on sale',
  'listing.reactivation_approved': 'Reactivation approved',
  'listing.reactivation_rejected': 'Reactivation declined',
  'listing.removed': 'Removed from the marketplace',
};

export const ACTOR_LABELS: Record<string, string> = {
  DEALER: 'Dealer',
  ADMIN: 'Dealers-Drive',
  SALES: 'Dealers-Drive Sales, for the dealer',
  SYSTEM: 'System',
};

export const SECTION_TITLES = {
  registration: 'Registration',
  basics: 'Vehicle basics',
  details: 'Vehicle details',
  pricing: 'Pricing',
} as const;

export const PHOTOGRAPHY_CLOSED =
  'Photography can only be updated while the listing is with the review team.';

export const APPROVAL_BLOCKED = 'This listing is not ready to approve yet.';

export const BLOCKER_MESSAGES = {
  DEALER_NOT_ACTIVE: 'The dealership is not active, so nothing of theirs can go live.',
  VEHICLE_INCOMPLETE: 'The vehicle details are incomplete.',
  CHECKS_INCOMPLETE: (missing: number) =>
    `${missing} verification ${missing === 1 ? 'check is' : 'checks are'} still unticked.`,
  TOO_FEW_IMAGES: (count: number, min: number) =>
    `${count} of the ${min} images needed ${count === 1 ? 'is' : 'are'} uploaded.`,
  NO_PRIMARY_IMAGE: 'No primary image is chosen.',
} as const;

export const REACTIVATION_REGISTRATION_TAKEN =
  'Another dealership has listed this registration since, so this car cannot go back on sale.';

export const SELF_REVIEW_FORBIDDEN =
  'You prepared or submitted this listing for the dealer, so another reviewer has to decide on it.';
