import type { ReactNode } from 'react';

import type { NavItem } from '@/types';

export interface MobileNavProps {
  items: readonly NavItem[];
  label: string;
  rootHref: string;
  children?: ReactNode;
}
