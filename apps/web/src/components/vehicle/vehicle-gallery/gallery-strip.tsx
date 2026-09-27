'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GalleryArrow } from './gallery-arrow';
import { STRIP_SCROLL_PX, VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { stripEdges } from './utils';

export interface GalleryStripProps {
  images: PublicVehicleImage[];
  onOpen: (index: number, opener: HTMLElement) => void;
}

export function GalleryStrip({ images, onOpen }: GalleryStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges(stripEdges(track));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  function scroll(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * STRIP_SCROLL_PX, behavior: 'smooth' });
  }

  return (
    <div className="relative mt-[14px] min-w-0 px-[52px] md:px-[34px]">
      <GalleryArrow
        direction="previous"
        placement="strip"
        label={VEHICLE_GALLERY_TEXT.scrollLeft}
        onClick={() => scroll(-1)}
        disabled={edges.atStart}
      />

      <div ref={trackRef} className="dd-strip" onScroll={measure}>
        {images.map((image, index) => (
          <button
            key={image.url}
            type="button"
            onClick={(event) => onOpen(index, event.currentTarget)}
            aria-label={VEHICLE_GALLERY_TEXT.openThumb(index, images.length)}
            className="relative aspect-[4/3] flex-[0_0_108px] cursor-zoom-in overflow-hidden border border-(--color-divider) bg-(--color-surface) p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-accent) max-sm:flex-[0_0_88px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <GalleryArrow
        direction="next"
        placement="strip"
        label={VEHICLE_GALLERY_TEXT.scrollRight}
        onClick={() => scroll(1)}
        disabled={edges.atEnd}
      />
    </div>
  );
}
