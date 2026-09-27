'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useCallback, useState, type KeyboardEvent } from 'react';

import { ImageSlot, Tag } from '@/components/ui/primitives';

import { GalleryArrow } from './gallery-arrow';
import { GalleryViewer } from './gallery-viewer';
import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { arrowStep, isTextEntry, startIndex, wrapIndex } from './utils';

export interface VehicleGalleryProps {
  title: string;
  images: PublicVehicleImage[];
  primaryIndex: number;
}

export function VehicleGallery({ title, images, primaryIndex }: VehicleGalleryProps) {
  const total = images.length;
  const [index, setIndex] = useState(() => startIndex(primaryIndex, total));
  const [open, setOpen] = useState(false);

  const step = useCallback(
    (delta: -1 | 1) => setIndex((currentIndex) => wrapIndex(currentIndex + delta, total)),
    [total],
  );

  const current = images[index];
  if (!current) {
    return (
      <div className="aspect-[4/3] border border-(--color-divider)">
        <ImageSlot label={VEHICLE_GALLERY_TEXT.noPhotos} className="h-full" />
      </div>
    );
  }

  const several = total > 1;

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!several || open || isTextEntry(event.target)) return;
    const delta = arrowStep(event.key);
    if (delta === null) return;
    event.preventDefault();
    step(delta);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={VEHICLE_GALLERY_TEXT.label}
      onKeyDown={onKeyDown}
      className="relative aspect-[4/3] min-w-0 overflow-hidden border border-(--color-divider) bg-(--color-neutral-200)"
    >
      <GalleryViewer
        title={title}
        images={images}
        index={index}
        open={open}
        onOpenChange={setOpen}
        onStep={step}
        trigger={
          <button
            type="button"
            aria-label={VEHICLE_GALLERY_TEXT.open(index, total)}
            className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.alt} className="h-full w-full object-cover" />
          </button>
        }
      />

      {several ? (
        <>
          <GalleryArrow direction="previous" onClick={() => step(-1)} />
          <GalleryArrow direction="next" onClick={() => step(1)} />
        </>
      ) : null}

      <Tag className="pointer-events-none absolute right-[10px] bottom-[10px] z-[2] bg-white text-[11px] tnum">
        <span aria-live="polite">{VEHICLE_GALLERY_TEXT.count(index, total)}</span>
      </Tag>
    </section>
  );
}
