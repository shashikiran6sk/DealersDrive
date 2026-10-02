import type { VehicleCardDto } from '@dealers-drive/contracts';

export interface DiscoveryRowProps {
  id: string;
  title: string;
  href: string;
  cars: readonly VehicleCardDto[];
}

export interface DiscoveryBandProps {
  row: DiscoveryRowProps | undefined;
}
