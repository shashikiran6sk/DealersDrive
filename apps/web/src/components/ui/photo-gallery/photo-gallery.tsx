'use client';

import { useCallback, useRef, useState } from 'react';

import { Blueprint, Corners, ImageSlot, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { GalleryArrow } from './gallery-arrow';
import { GalleryStrip } from './gallery-strip';
import { GalleryViewer } from './gallery-viewer';
import { DEFAULT_STAGE_CLASS, PHOTO_GALLERY_TEXT } from './photo-gallery.constants';
import type { GalleryStep, PhotoGalleryProps } from './photo-gallery.types';
import { useSwipe } from './use-swipe';
import { initialIndex, wrapIndex } from './utils';

export function PhotoGallery({
  title,
  photos,
  startIndex = 0,
  strip = true,
  stageClassName = DEFAULT_STAGE_CLASS,
  emptyLabel = PHOTO_GALLERY_TEXT.noPhotos,
}: PhotoGalleryProps) {
  const total = photos.length;
  const first = initialIndex(startIndex, total);
  const several = total > 1;
  const [index, setIndex] = useState(first);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const step = useCallback(
    (delta: GalleryStep) => setIndex((currentIndex) => wrapIndex(currentIndex + delta, total)),
    [total],
  );

  const swipe = useSwipe(step, several);

  const openAt = useCallback((at: number, opener: HTMLElement) => {
    openerRef.current = opener;
    setIndex(at);
    setOpen(true);
  }, []);

  const returnFocus = useCallback((event: Event) => {
    event.preventDefault();
    openerRef.current?.focus();
  }, []);

  const main = photos[index] ?? photos[first];
  if (!main) {
    return (
      <Blueprint className={cn('bg-(--color-surface)', stageClassName)}>
        <ImageSlot label={emptyLabel} />
      </Blueprint>
    );
  }

  return (
    <section aria-label={PHOTO_GALLERY_TEXT.label} className="min-w-0">
      <div {...swipe} className="relative touch-pan-y">
        <button
          type="button"
          onClick={(event) => openAt(index, event.currentTarget)}
          aria-label={PHOTO_GALLERY_TEXT.openAll(title, total)}
          className={cn(
            'blueprint block w-full cursor-zoom-in bg-(--color-surface) p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus)',
            stageClassName,
          )}
        >
          <Corners />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.url}
            alt={main.alt}
            fetchPriority={index === first ? 'high' : undefined}
            className="h-full w-full object-cover"
          />
          <Tag className="absolute right-[10px] bottom-[10px] z-[3] bg-white text-[11px] tnum">
            {several ? PHOTO_GALLERY_TEXT.viewAll(index, total) : PHOTO_GALLERY_TEXT.viewOne}
          </Tag>
        </button>

        {several ? (
          <>
            <GalleryArrow
              direction="previous"
              placement="stage"
              label={PHOTO_GALLERY_TEXT.heroPrevious}
              onClick={() => step(-1)}
            />
            <GalleryArrow
              direction="next"
              placement="stage"
              label={PHOTO_GALLERY_TEXT.heroNext}
              onClick={() => step(1)}
            />
          </>
        ) : null}
      </div>

      {strip && several ? <GalleryStrip photos={photos} index={index} onOpen={openAt} /> : null}

      <GalleryViewer
        title={title}
        photos={photos}
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
