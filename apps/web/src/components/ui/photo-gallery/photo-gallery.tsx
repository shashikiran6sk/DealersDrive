'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Corners, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { classifyPhoto } from './classify-photo';
import { GalleryArrow } from './gallery-arrow';
import { GalleryFallback } from './gallery-fallback';
import { GalleryStrip } from './gallery-strip';
import { GalleryViewer } from './gallery-viewer';
import {
  DEFAULT_STAGE_CLASS,
  PHOTO_GALLERY_TEXT,
  STAGE_VARIANT_CLASS,
} from './photo-gallery.constants';
import type { GalleryStep, PhotoGalleryProps, PhotoKind } from './photo-gallery.types';
import { StudioWhiteFilter } from './studio-white-filter';
import { useSwipe } from './use-swipe';
import { initialIndex, studioFilterId, wrapIndex } from './utils';

export function PhotoGallery({
  title,
  photos,
  startIndex = 0,
  strip = true,
  stageClassName = DEFAULT_STAGE_CLASS,
  emptyLabel = PHOTO_GALLERY_TEXT.noPhotos,
  fallback,
  variant = 'cover',
}: PhotoGalleryProps) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [kinds, setKinds] = useState<ReadonlyMap<string, PhotoKind>>(() => new Map());
  const filterId = studioFilterId(useId());
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

  const variantClass = STAGE_VARIANT_CLASS[variant];
  const current = wrapIndex(index, total);
  const main = shown[current];
  const mainUrl = main?.url;
  const whitened = variant === 'studio' && mainUrl !== undefined && kinds.get(mainUrl) !== 'photo';

  const markFailed = useCallback((url: string) => {
    setFailed((previous) => (previous.has(url) ? previous : new Set(previous).add(url)));
  }, []);

  const classify = useCallback(
    (url: string, image: HTMLImageElement) => {
      if (variant !== 'studio') return;
      const kind = classifyPhoto(image);
      if (kind === null) return;
      setKinds((previous) =>
        previous.get(url) === kind ? previous : new Map(previous).set(url, kind),
      );
    },
    [variant],
  );

  useEffect(() => {
    const image = stageImageRef.current;
    if (mainUrl && image?.complete && image.naturalWidth === 0) markFailed(mainUrl);
    else if (mainUrl && image) classify(mainUrl, image);
  }, [mainUrl, markFailed, classify]);

  if (!main) {
    return (
      <GalleryFallback label={emptyLabel} stageClassName={stageClassName} fallback={fallback} />
    );
  }

  return (
    <section aria-label={PHOTO_GALLERY_TEXT.label} className="min-w-0">
      {variant === 'studio' ? <StudioWhiteFilter id={filterId} /> : null}
      <div {...swipe} className="relative touch-pan-y touch-pinch-zoom">
        <button
          type="button"
          onClick={(event) => openAt(current, event.currentTarget)}
          aria-label={PHOTO_GALLERY_TEXT.openAll(title, total)}
          className={cn(
            'blueprint block w-full cursor-zoom-in p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus)',
            variantClass.stage,
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
            className={cn('h-full w-full', variantClass.image)}
            style={whitened ? { filter: `url(#${filterId})` } : undefined}
            onLoad={(event) => classify(main.url, event.currentTarget)}
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
