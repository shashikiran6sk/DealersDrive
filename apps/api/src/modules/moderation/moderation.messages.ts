export const HISTORY_LABELS: Record<string, string> = {
  'listing.submitted': 'Submitted for review',
  'listing.resubmitted': 'Resubmitted after changes',
  'listing.changes_requested': 'Changes requested',
  'listing.rejected': 'Rejected',
  'listing.approved': 'Approved and published',
  'listing.marked_sold': 'Marked sold',
  'listing.removed': 'Removed from the marketplace',
};

export const ACTOR_LABELS: Record<string, string> = {
  DEALER: 'Dealer',
  ADMIN: 'Dealers-Drive',
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
