import type { ReactNode } from 'react';

import type { VehicleSearchParams } from '@/lib/vehicle-search';

export interface SearchToolbarProps {
  params: VehicleSearchParams;
  basePath: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  idPrefix?: string;
  leading?: ReactNode;
  className?: string;
}
