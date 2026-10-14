'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Corners, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { GalleryArrow } from './gallery-arrow';
import { GalleryFallback } from './gallery-fallback';
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
  fallback,
}: PhotoGalleryProps) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = useMemo(() => photos.filter((photo) => !failed.has(photo.url)), [photos, failed]);
  const total = shown.length;
  const first = initialIndex(startIndex, photos.length);
  const several = total > 1;
  const [index, setIndex] = useState(first);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const stageImageRef = useRef<HTMLImageElement | null>(null);

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

  const current = wrapIndex(index, total);
  const main = shown[current];
  const mainUrl = main?.url;

  const markFailed = useCallback((url: string) => {
    setFailed((previous) => (previous.has(url) ? previous : new Set(previous).add(url)));
  }, []);

  useEffect(() => {
    const image = stageImageRef.current;
    if (mainUrl && image?.complete && image.naturalWidth === 0) markFailed(mainUrl);
  }, [mainUrl, markFailed]);

  if (!main) {
    return (
      <GalleryFallback label={emptyLabel} stageClassName={stageClassName} fallback={fallback} />
    );
  }

  return (
    <section aria-label={PHOTO_GALLERY_TEXT.label} className="min-w-0">
      <div {...swipe} className="relative touch-pan-y">
        <button
          type="button"
          onClick={(event) => openAt(current, event.currentTarget)}
          aria-label={PHOTO_GALLERY_TEXT.openAll(title, total)}
          className={cn(
            'blueprint block w-full cursor-zoom-in bg-(--color-surface) p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus)',
            stageClassName,
          )}
        >
          <Corners />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={stageImageRef}
            src={main.url}
            alt={main.alt}
            fetchPriority={current === first ? 'high' : undefined}
            className="h-full w-full object-cover"
            onError={() => markFailed(main.url)}
          />
          <Tag className="absolute right-[10px] bottom-[10px] z-[3] bg-white text-[11px] tnum">
            {several ? PHOTO_GALLERY_TEXT.viewAll(current, total) : PHOTO_GALLERY_TEXT.viewOne}
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

      {strip && several ? <GalleryStrip photos={shown} index={current} onOpen={openAt} /> : null}

      <GalleryViewer
        title={title}
        photos={shown}
        index={current}
        open={open}
        onOpenChange={setOpen}
        onSelect={setIndex}
        onStep={step}
        onCloseAutoFocus={returnFocus}
      />
    </section>
  );
}
