import type { VehicleCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { DealerStrip } from './dealer-strip';
import { VEHICLE_CARD_TEXT, vehicleHref } from './vehicle-card.constants';
import { VehicleImage } from './vehicle-image';

export interface VehicleCardProps {
  vehicle: VehicleCardDto;
  priority?: boolean;
  className?: string;
}

export function VehicleCard({ vehicle, priority = false, className }: VehicleCardProps) {
  return (
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden bg-white p-0',
        'transition-colors duration-150 hover:border-(--color-accent)',
        className,
      )}
    >
      <div className="relative aspect-[4/3] border-b border-(--color-divider) bg-(--color-neutral-200)">
        <VehicleImage image={vehicle.image} priority={priority} />
        {vehicle.year ? (
          <Plate className="absolute top-[10px] left-[10px] z-[2]">{vehicle.year}</Plate>
        ) : null}
      </div>

      <div className="flex flex-col gap-[9px] px-[13px] pt-[12px] pb-[14px]">
        <h3 className="line-clamp-2 font-heading text-[15px] font-semibold leading-[1.25]">
          <Link href={vehicleHref(vehicle.slug)} className="after:absolute after:inset-0">
            {vehicle.title}
          </Link>
        </h3>
        <div className="text-[20px] font-bold tnum">
          {vehicle.priceLabel ?? VEHICLE_CARD_TEXT.priceOnRequest}
        </div>
        <div className="text-[12px] ink-secondary tnum">{vehicle.metaLabel}</div>
        <DealerStrip dealer={vehicle.dealer} />
      </div>
    </article>
  );
}
