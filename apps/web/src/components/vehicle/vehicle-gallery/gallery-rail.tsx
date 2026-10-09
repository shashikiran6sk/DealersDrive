'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { railNumber } from './utils';

export interface GalleryRailProps {
  images: PublicVehicleImage[];
  index: number;
  onSelect: (index: number) => void;
}

export function GalleryRail({ images, index, onSelect }: GalleryRailProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  return (
    <nav
      aria-label={VEHICLE_GALLERY_TEXT.railLabel}
      className="dd-rail w-[84px] flex-none border-r border-white/15 p-3 max-md:order-last max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:overflow-y-hidden max-md:border-r-0 max-md:border-t max-md:pb-[max(12px,env(safe-area-inset-bottom))] md:w-[132px]"
    >
      {images.map((image, cell) => {
        const active = cell === index;
        return (
          <button
            key={image.url}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(cell)}
            aria-current={active || undefined}
            aria-label={VEHICLE_GALLERY_TEXT.railCell(cell, images.length)}
            className={cn(
              'relative aspect-[4/3] w-full flex-none max-md:w-[72px] overflow-hidden border-2 bg-[#1a1f29] p-0',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white',
              active ? 'border-(--color-accent)' : 'border-transparent',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 z-[3] bg-[rgba(13,16,23,0.75)] px-[5px] py-px font-mono text-[10px] text-white"
            >
              {railNumber(cell)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
