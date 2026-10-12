import { canDealer } from '@dealers-drive/contracts';

import type { NavItem } from '@/types';

import {
  DOCUMENTS_NAV_ITEM,
  LANDED_NAV,
  PHOTOS_NAV_ITEM,
  TEAM_NAV_ITEM,
} from './console-nav.constants';

export function consoleNavFor(permissions: readonly string[]): NavItem[] {
  return [
    ...LANDED_NAV,
    ...(canDealer(permissions, 'dealer:update') ? [PHOTOS_NAV_ITEM] : []),
    ...(canDealer(permissions, 'document:upload') ? [DOCUMENTS_NAV_ITEM] : []),
    ...(canDealer(permissions, 'member:manage') ? [TEAM_NAV_ITEM] : []),
  ];
}
