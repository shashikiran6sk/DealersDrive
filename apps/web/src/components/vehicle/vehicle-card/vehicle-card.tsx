import type { VehicleCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Plate } from '@/components/ui/primitives';
import { SaveButton } from '@/components/vehicle/save-button';
import { cn } from '@/lib/cn';

import { DealerStrip } from './dealer-strip';
import { AvailabilityBadge } from './availability-badge';
import { availabilityLabel, availabilityNote } from './utils';
import { VEHICLE_CARD_TEXT, vehicleHref } from './vehicle-card.constants';
import { VehicleImage } from './vehicle-image';

export type VehicleCardVariant = 'grid' | 'compact';

export interface VehicleCardProps {
  vehicle: VehicleCardDto;
  variant?: VehicleCardVariant;
  priority?: boolean;
  className?: string;
}

export function VehicleCard({
  vehicle,
  variant = 'grid',
  priority = false,
  className,
}: VehicleCardProps) {
  const unavailable = vehicle.availability !== 'AVAILABLE';

  return (
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden bg-white p-0',
        unavailable
          ? 'cursor-default'
          : 'transition-colors duration-150 hover:border-(--color-accent)',
        className,
      )}
    >
      <div className="relative aspect-[4/3] border-b border-(--color-divider) bg-(--color-neutral-200)">
        <VehicleImage
          image={vehicle.image}
          priority={priority}
          className={unavailable ? 'opacity-60 grayscale' : undefined}
        />
        {vehicle.year ? (
          <Plate className="absolute top-[10px] left-[10px] z-[2]">{vehicle.year}</Plate>
        ) : null}
        {unavailable ? <AvailabilityBadge label={availabilityLabel(vehicle.availability)} /> : null}
        <SaveButton
          slug={vehicle.slug}
          title={vehicle.title}
          className="absolute top-[10px] right-[10px]"
        />
      </div>

      <div
        className={cn(
          'flex flex-col px-[13px] pt-[12px] pb-[14px]',
          variant === 'compact' ? 'gap-[8px]' : 'gap-[9px]',
          unavailable && 'ink-muted',
        )}
      >
        <h3 className="line-clamp-2 font-heading text-[15px] font-semibold leading-[1.25]">
          {unavailable ? (
            <span>
              {vehicle.title}
              <span className="sr-only">
                {' — '}
                {availabilityNote(vehicle.availability)}
              </span>
            </span>
          ) : (
            <Link href={vehicleHref(vehicle.slug)} className="after:absolute after:inset-0">
              {vehicle.title}
            </Link>
          )}
        </h3>
        <div className="text-[20px] font-bold tnum">
          {vehicle.priceLabel ?? VEHICLE_CARD_TEXT.priceOnRequest}
        </div>
        <div className="text-[12px] ink-secondary tnum">{vehicle.metaLabel}</div>
        {variant === 'compact' ? null : <DealerStrip dealer={vehicle.dealer} />}
      </div>
    </article>
  );
}
