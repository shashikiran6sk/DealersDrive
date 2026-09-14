import type { AdminNavItem } from './admin-nav.types';

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/config', label: 'Configuration' },
];

const NOT_YET_BUILT = new Set(['/admin/listings', '/admin/payments']);

export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !NOT_YET_BUILT.has(item.href),
);

export const ADMIN_NAV_LABEL = 'Admin console';
export const ADMIN_ROOT_HREF = '/admin';
