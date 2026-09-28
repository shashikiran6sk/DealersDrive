import type { VehicleCardDto } from '@dealers-drive/contracts';

export interface DiscoveryRowProps {
  id: string;
  title: string;
  href: string;
  total: number;
  cars: readonly VehicleCardDto[];
}
