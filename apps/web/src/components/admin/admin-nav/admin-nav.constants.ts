import type { AdminNavItem } from './admin-nav.types';

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/enquiries', label: 'Enquiries' },
  { href: '/admin/support', label: 'Support Tickets' },
  { href: '/admin/members', label: 'Members', permission: 'admin:access:manage' },
  {
    href: '/admin/notifications',
    label: 'Email deliveries',
    permission: 'admin:notifications:read',
  },
  { href: '/admin/config', label: 'Configuration', permission: 'admin:config:write' },
];

const NOT_YET_BUILT = new Set(['/admin/payments']);

export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !NOT_YET_BUILT.has(item.href),
);

export function adminNavFor(permissions: readonly string[]): AdminNavItem[] {
  return LANDED_ADMIN_NAV.filter(
    (item) => item.permission === undefined || permissions.includes(item.permission),
  );
}

export const ADMIN_NAV_LABEL = 'Admin console';
export const ADMIN_ROOT_HREF = '/admin';
