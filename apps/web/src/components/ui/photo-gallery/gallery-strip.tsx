'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { GalleryArrow } from './gallery-arrow';
import { PHOTO_GALLERY_TEXT, STRIP_SCROLL_PX } from './photo-gallery.constants';
import type { GalleryPhoto } from './photo-gallery.types';
import { revealOffset, stripEdges } from './utils';

export interface GalleryStripProps {
  photos: readonly GalleryPhoto[];
  index: number;
  onOpen: (index: number, opener: HTMLElement) => void;
}

export function GalleryStrip({ photos, index, onOpen }: GalleryStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const shownRef = useRef(index);
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

  useEffect(() => {
    if (shownRef.current === index) return;
    shownRef.current = index;
    const track = trackRef.current;
    const thumb = activeRef.current;
    if (!track || !thumb) return;
    const offset = revealOffset(track.getBoundingClientRect(), thumb.getBoundingClientRect());
    if (offset !== 0) track.scrollBy({ left: offset, behavior: 'smooth' });
  }, [index]);

  function scroll(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * STRIP_SCROLL_PX, behavior: 'smooth' });
  }

  return (
    <div className="relative mt-[14px] min-w-0 px-[52px] md:px-[34px]">
      <GalleryArrow
        direction="previous"
        placement="strip"
        label={PHOTO_GALLERY_TEXT.scrollLeft}
        onClick={() => scroll(-1)}
        disabled={edges.atStart}
      />

      <div ref={trackRef} className="dd-strip" onScroll={measure}>
        {photos.map((photo, cell) => (
          <button
            key={photo.url}
            ref={cell === index ? activeRef : undefined}
            type="button"
            onClick={(event) => onOpen(cell, event.currentTarget)}
            aria-label={PHOTO_GALLERY_TEXT.openThumb(cell, photos.length)}
            aria-current={cell === index || undefined}
            className={cn(
              'relative aspect-[4/3] flex-[0_0_108px] cursor-zoom-in overflow-hidden rounded-[10px] border bg-(--color-surface) p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus) max-sm:flex-[0_0_88px]',
              cell === index
                ? 'border-(--color-accent) ring-1 ring-(--color-accent)'
                : 'border-(--color-divider)',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <GalleryArrow
        direction="next"
        placement="strip"
        label={PHOTO_GALLERY_TEXT.scrollRight}
        onClick={() => scroll(1)}
        disabled={edges.atEnd}
      />
    </div>
  );
}
