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
        'card group relative h-full min-w-0 gap-0 overflow-hidden rounded-[15px] bg-white p-0 shadow-sm',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--color-focus)',
        unavailable
          ? 'cursor-default'
          : 'transition-colors duration-150 hover:border-(--color-neutral-400)',
        className,
      )}
    >
      <div className="relative aspect-[1.6] flex-none overflow-hidden border-b border-(--color-divider) bg-(--color-neutral-150) sm:aspect-[1.75]">
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
          'flex min-w-0 flex-1 flex-col px-[14px] pt-[13px] pb-[14px]',
          variant === 'compact' ? 'gap-[8px]' : 'gap-[8px]',
          unavailable && 'ink-muted',
        )}
      >
        <h3 className="line-clamp-2 min-h-[2.5em] font-heading text-[14px] font-extrabold leading-[1.25] tracking-[-0.015em]">
          {unavailable ? (
            <span>
              {vehicle.title}
              <span className="sr-only">
                {' — '}
                {availabilityNote(vehicle.availability)}
              </span>
            </span>
          ) : (
            <Link
              href={vehicleHref(vehicle.slug)}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {vehicle.title}
            </Link>
          )}
        </h3>
        <div className="text-[20px] font-bold tracking-[-0.02em] tnum">
          {vehicle.priceLabel ?? VEHICLE_CARD_TEXT.priceOnRequest}
        </div>
        <div className="line-clamp-2 min-h-[3em] text-[12px] leading-[1.5] ink-muted tnum">
          {vehicle.metaLabel}
        </div>
        {variant === 'compact' ? null : <DealerStrip dealer={vehicle.dealer} />}
      </div>
    </article>
  );
}
