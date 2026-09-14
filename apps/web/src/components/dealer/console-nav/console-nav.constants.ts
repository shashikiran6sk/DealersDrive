import type { NavItem } from '@/types';

export const DEALER_ROOT_HREF = '/dealer';
export const DEALER_NAV_LABEL = 'Dealer console';

export const DEALER_NAV: NavItem[] = [
  { href: '/dealer', label: 'Dashboard', short: 'Home' },
  { href: '/dealer/inventory', label: 'Inventory', short: 'Stock' },
  { href: '/dealer/vehicles/new', label: 'Add vehicle', short: 'Add' },
  { href: '/dealer/enquiries', label: 'Enquiries', short: 'Leads' },
  { href: '/dealer/billing', label: 'Billing', short: 'Billing' },
  { href: '/dealer/profile', label: 'Dealer profile' },
];

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `DEALER_NAV` is the baseline's list, verbatim, because it is the shell's
 * shape and the next five features fill it in. The nav renders only the routes
 * that exist:
 *
 *   /dealer/inventory     F050  Dealer inventory list
 *   /dealer/vehicles/new  F056  The vehicle wizard
 *   /dealer/enquiries     F065  Dealer enquiries
 *   /dealer/billing       F051  Credits & billing
 *
 * A nav item pointing at a 404 is worse than a missing one, so each feature
 * above deletes its own line from this set as it lands. When the set is empty
 * the constant goes with it and `DEALER_NAV` is used directly.
 *
 * A `Set` of hrefs rather than a shortened `DEALER_NAV` deliberately: a
 * reviewer comparing this file against the baseline should find the list
 * identical and the omission stated separately.
 * ────────────────────────────────────────────────────────────────────────────
 */
const NOT_YET_BUILT = new Set([
  '/dealer/inventory',
  '/dealer/vehicles/new',
  '/dealer/enquiries',
  '/dealer/billing',
]);

/** The items whose routes a dealer can actually reach today. */
export const LANDED_NAV: NavItem[] = DEALER_NAV.filter((item) => !NOT_YET_BUILT.has(item.href));

/**
 * How many items the bar carries when the console is complete (§3.11): Dashboard,
 * Inventory, Add vehicle, Enquiries, Billing. `Dealer profile` is deliberately
 * not one of them — the credits card moves into Billing below 768.
 */
export const FULL_BAR = 5;
