'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useCallback, useRef, useState } from 'react';

import { Corners, ImageSlot, Tag } from '@/components/ui/primitives';

import { GalleryArrow } from './gallery-arrow';
import { GalleryStrip } from './gallery-strip';
import { GalleryViewer } from './gallery-viewer';
import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { startIndex, wrapIndex } from './utils';

export interface VehicleGalleryProps {
  title: string;
  images: PublicVehicleImage[];
  primaryIndex: number;
}

export function VehicleGallery({ title, images, primaryIndex }: VehicleGalleryProps) {
  const total = images.length;
  const primary = startIndex(primaryIndex, total);
  const [index, setIndex] = useState(primary);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const step = useCallback(
    (delta: -1 | 1) => setIndex((currentIndex) => wrapIndex(currentIndex + delta, total)),
    [total],
  );

  const openAt = useCallback((at: number, opener: HTMLElement) => {
    openerRef.current = opener;
    setIndex(at);
    setOpen(true);
  }, []);

  const returnFocus = useCallback((event: Event) => {
    event.preventDefault();
    openerRef.current?.focus();
  }, []);

  const main = images[index] ?? images[primary];
  if (!main) {
    return (
      <div className="blueprint aspect-[4/3]">
        <Corners />
        <ImageSlot label={VEHICLE_GALLERY_TEXT.noPhotos} className="h-full" />
      </div>
    );
  }

  return (
    <section aria-label={VEHICLE_GALLERY_TEXT.label} className="min-w-0">
      <div className="relative">
        <button
          type="button"
          onClick={(event) => openAt(index, event.currentTarget)}
          aria-label={VEHICLE_GALLERY_TEXT.openAll(title, total)}
          className="blueprint block aspect-[4/3] w-full cursor-zoom-in bg-(--color-surface) p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus)"
        >
          <Corners />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.url}
            alt={main.alt}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <Tag className="absolute right-[10px] bottom-[10px] z-[3] bg-white text-[11px] tnum">
            {VEHICLE_GALLERY_TEXT.viewAll(total)}
          </Tag>
        </button>

        {total > 1 ? (
          <>
            <GalleryArrow
              direction="previous"
              placement="stage"
              label={VEHICLE_GALLERY_TEXT.heroPrevious}
              onClick={() => step(-1)}
            />
            <GalleryArrow
              direction="next"
              placement="stage"
              label={VEHICLE_GALLERY_TEXT.heroNext}
              onClick={() => step(1)}
            />
          </>
        ) : null}
      </div>

      {total > 1 ? <GalleryStrip images={images} index={index} onOpen={openAt} /> : null}

      <GalleryViewer
        title={title}
        images={images}
        index={index}
        open={open}
        onOpenChange={setOpen}
        onSelect={setIndex}
        onStep={step}
        onCloseAutoFocus={returnFocus}
      />
    </section>
  );
}
