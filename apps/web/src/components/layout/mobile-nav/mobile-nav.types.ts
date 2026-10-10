import type { ReactNode } from 'react';

import type { NavItem } from '@/types';

export interface MobileNavProps {
  items: readonly NavItem[];
  label: string;
  showTitle?: boolean;
  rootHref: string;
  heading?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
}
