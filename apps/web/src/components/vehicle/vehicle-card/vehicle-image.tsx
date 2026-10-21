'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useEffect, useRef, useState } from 'react';

import { ImageSlot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { VEHICLE_CARD_TEXT } from './vehicle-card.constants';

export interface VehicleImageProps {
  image: PublicVehicleImage | null;
  className?: string;
  priority?: boolean;
}

export function VehicleImage({ image, className, priority = false }: VehicleImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url ?? null;

  useEffect(() => {
    const element = ref.current;
    if (url && element?.complete && element.naturalWidth === 0) setFailedUrl(url);
  }, [url]);

  if (!image || failedUrl === image.url) {
    return <ImageSlot label={VEHICLE_CARD_TEXT.noPhoto} className={cn('h-full', className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={image.url}
      alt={image.alt}
      className={cn('h-full w-full object-cover', className)}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailedUrl(image.url)}
    />
  );
}
