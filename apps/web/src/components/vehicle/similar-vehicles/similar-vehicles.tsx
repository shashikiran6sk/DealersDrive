import type { VehicleCardDto } from '@dealers-drive/contracts';

import { VehicleCard } from '@/components/vehicle/vehicle-card';

import { SIMILAR_VEHICLES_TEXT } from './similar-vehicles.constants';

export interface SimilarVehiclesProps {
  vehicles: readonly VehicleCardDto[];
}

export function SimilarVehicles({ vehicles }: SimilarVehiclesProps) {
  if (vehicles.length === 0) return null;

  return (
    <section aria-labelledby="similar-heading" className="flex flex-col gap-[14px]">
      <div>
        <h2 id="similar-heading" className="text-[22px]">
          {SIMILAR_VEHICLES_TEXT.heading}
        </h2>
        <p className="text-[13px] ink-muted">{SIMILAR_VEHICLES_TEXT.description}</p>
      </div>
      <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] max-md:[grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.slug} vehicle={vehicle} />
        ))}
      </div>
    </section>
  );
}
