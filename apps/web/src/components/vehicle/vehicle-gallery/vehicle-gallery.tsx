'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useState } from 'react';

import { ImageSlot, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';

export interface VehicleGalleryProps {
  images: PublicVehicleImage[];
  primaryIndex: number;
}

export function VehicleGallery({ images, primaryIndex }: VehicleGalleryProps) {
  const [selected, setSelected] = useState(
    primaryIndex >= 0 && primaryIndex < images.length ? primaryIndex : 0,
  );
  const current = images[selected];

  if (!current) {
    return (
      <div className="aspect-[4/3] border border-(--color-divider)">
        <ImageSlot label={VEHICLE_GALLERY_TEXT.noPhotos} className="h-full" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-[14px]">
      <figure className="relative m-0 aspect-[4/3] border border-(--color-divider) bg-(--color-neutral-200)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt} className="h-full w-full object-cover" />
        <Tag className="absolute right-[10px] bottom-[10px] bg-white text-[11px] tnum">
          {VEHICLE_GALLERY_TEXT.count(selected, images.length)}
        </Tag>
      </figure>

      {images.length > 1 ? (
        <ul
          aria-label={VEHICLE_GALLERY_TEXT.thumbsLabel}
          className="flex gap-[8px] overflow-x-auto pb-[4px]"
        >
          {images.map((image, index) => (
            <li key={image.url} className="flex-[0_0_108px]">
              <button
                type="button"
                aria-label={VEHICLE_GALLERY_TEXT.showLabel(index, images.length)}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
                className={cn(
                  'block aspect-[4/3] w-full overflow-hidden border',
                  index === selected ? 'border-(--color-accent)' : 'border-(--color-divider)',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
