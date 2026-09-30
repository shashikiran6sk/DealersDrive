import { DiscoveryRow } from './discovery-row';
import type { DiscoveryBandProps } from './discovery-row.types';

export function DiscoveryBand({ row }: DiscoveryBandProps) {
  if (!row || row.cars.length === 0) return null;

  return (
    <div
      data-home-section={row.id}
      className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12"
    >
      <DiscoveryRow {...row} />
    </div>
  );
}
