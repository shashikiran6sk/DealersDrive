import type { PublicVehicleImage } from '@dealers-drive/contracts';

import { ImageSlot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { VEHICLE_CARD_TEXT } from './vehicle-card.constants';

export interface VehicleImageProps {
  image: PublicVehicleImage | null;
  className?: string;
  priority?: boolean;
}

export function VehicleImage({ image, className, priority = false }: VehicleImageProps) {
  if (!image) {
    return <ImageSlot label={VEHICLE_CARD_TEXT.noPhoto} className={cn('h-full', className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={image.alt}
      className={cn('h-full w-full object-cover', className)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
