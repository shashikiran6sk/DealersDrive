import type { VehicleSearchParams } from '@/lib/vehicle-search';

export interface CarSearchBoxProps {
  params: VehicleSearchParams;
  basePath: string;
  districtName?: string;
  action?: string;
  className?: string;
}
