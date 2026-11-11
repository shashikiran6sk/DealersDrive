import { VehicleImage } from '@/components/vehicle/vehicle-card';

import type { StreamCardProps } from './stock-stream.types';

export function StreamCard({ car }: StreamCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] border border-(--color-divider) bg-white">
      <div className="aspect-[4/3] bg-(--color-neutral-150)">
        <VehicleImage image={car.image} />
      </div>
      <div className="flex flex-col gap-0.5 px-3.5 pt-2.5 pb-3.5">
        <span className="text-[13px] font-bold">{car.title}</span>
        {car.priceLabel ? (
          <span className="tnum text-[16px] font-extrabold">{car.priceLabel}</span>
        ) : null}
        <span className="text-[11px] ink-muted">{car.metaLabel}</span>
      </div>
    </article>
  );
}
