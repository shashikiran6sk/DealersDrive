import type { AdminPermission } from '@dealers-drive/contracts';

import type { NavItem } from '@/types';

export interface AdminNavItem extends NavItem {
  permission?: AdminPermission;
}
