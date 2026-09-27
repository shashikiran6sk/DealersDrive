import type { VehicleFacets } from '@dealers-drive/contracts';

import type { VehicleSearchParams } from '@/lib/vehicle-search';

export type FilterGroupKey =
  | 'city'
  | 'brand'
  | 'model'
  | 'price'
  | 'year'
  | 'km'
  | 'fuel'
  | 'transmission'
  | 'bodyType'
  | 'color'
  | 'owners'
  | 'dealer';

export interface FilterPanelProps {
  facets: VehicleFacets;
  params: VehicleSearchParams;
  basePath: string;
  groups?: readonly FilterGroupKey[];
  idPrefix?: string;
  heading?: string;
  className?: string;
}
