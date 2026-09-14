import type { AdminNavItem } from './admin-nav.types';

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/config', label: 'Configuration' },
];

/*
 * ── Reconstruction slice (F048) ─────────────────────────────────────────────
 * `ADMIN_NAV` above is the baseline's list, verbatim, because it is the shell's
 * shape. Two of its five routes do not exist:
 *
 *   /admin/listings   F069  The moderation queue
 *   /admin/payments   F053  Payments and credit grants
 *
 * They were offered anyway from F049 until now, so two of the five items in a
 * cross-tenant operations console led to a 404. **Each feature above deletes
 * its own line from this set**, and its item appears. When the set is empty the
 * constant goes with it and `ADMIN_NAV` is rendered directly.
 *
 * A `Set` of hrefs rather than a shortened list so that a reviewer comparing
 * this file against the baseline finds the list identical and the omission
 * stated separately.
 * ────────────────────────────────────────────────────────────────────────────
 */
const NOT_YET_BUILT = new Set(['/admin/listings', '/admin/payments']);

/** The items whose routes an operator can actually reach today. */
export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !NOT_YET_BUILT.has(item.href),
);

export const ADMIN_NAV_LABEL = 'Admin console';
export const ADMIN_ROOT_HREF = '/admin';
