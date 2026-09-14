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

const NOT_YET_BUILT = new Set([
  '/dealer/inventory',
  '/dealer/vehicles/new',
  '/dealer/enquiries',
  '/dealer/billing',
]);

export const LANDED_NAV: NavItem[] = DEALER_NAV.filter((item) => !NOT_YET_BUILT.has(item.href));

export const FULL_BAR = 5;
