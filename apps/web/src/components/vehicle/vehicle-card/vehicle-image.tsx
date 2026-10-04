import type { PublicVehicleImage } from '@dealers-drive/contracts';

import { ImageSlot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { responsiveImage } from '@/lib/media-images';

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
      srcSet={responsiveImage(image.url)}
      sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 45vw, 320px"
      alt={image.alt}
      className={cn('h-full w-full object-cover', className)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}
