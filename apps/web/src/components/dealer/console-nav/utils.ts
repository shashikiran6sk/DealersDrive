import { canDealer } from '@dealers-drive/contracts';

import type { NavItem } from '@/types';

import { LANDED_NAV, TEAM_NAV_ITEM } from './console-nav.constants';

export function consoleNavFor(permissions: readonly string[]): NavItem[] {
  return canDealer(permissions, 'member:manage') ? [...LANDED_NAV, TEAM_NAV_ITEM] : LANDED_NAV;
}
