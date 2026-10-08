import { canDealer } from '@dealers-drive/contracts';

import type { NavItem } from '@/types';

import { LANDED_NAV, TEAM_NAV_ITEM, WEBSITE_NAV_ITEM } from './console-nav.constants';

export function consoleNavFor(permissions: readonly string[]): NavItem[] {
  return [
    ...LANDED_NAV,
    ...(canDealer(permissions, 'storefront:read') ? [WEBSITE_NAV_ITEM] : []),
    ...(canDealer(permissions, 'member:manage') ? [TEAM_NAV_ITEM] : []),
  ];
}
