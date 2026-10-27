'use client';

import { useEffect } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';

import { cn } from '@/lib/cn';

import { GalleryArrow } from './gallery-arrow';
import { GalleryRail } from './gallery-rail';
import { GalleryZoomControls } from './gallery-zoom-controls';
import { PHOTO_GALLERY_TEXT } from './photo-gallery.constants';
import type { GalleryPhoto, GalleryStep } from './photo-gallery.types';
import { useSwipe } from './use-swipe';
import { useZoom } from './use-zoom';
import { arrowPan, arrowStep, captionOf, hasModifier, zoomKey, zoomTransform } from './utils';

export interface GalleryViewerProps {
  title: string;
  photos: readonly GalleryPhoto[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (index: number) => void;
  onStep: (delta: GalleryStep) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function GalleryViewer({
  title,
  photos,
  index,
  open,
  onOpenChange,
  onSelect,
  onStep,
  onCloseAutoFocus,
}: GalleryViewerProps) {
  const current = photos[index];
  const several = photos.length > 1;
  const zoom = useZoom(`${open}:${current?.url ?? ''}`);
  const { zoomed, act, pan } = zoom;
  const swipe = useSwipe(onStep, several && !zoomed);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (hasModifier(event)) return;
      const action = zoomKey(event.key);
      if (action !== null) {
        event.preventDefault();
        act(action);
        return;
      }
      const offset = zoomed ? arrowPan(event.key) : null;
      if (offset !== null) {
        event.preventDefault();
        pan(offset);
        return;
      }
      const delta = several ? arrowStep(event.key) : null;
      if (delta === null) return;
      event.preventDefault();
      onStep(delta);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, several, onStep, zoomed, act, pan]);

  return (
    <Dialog
      variant="fullscreen"
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      contentClassName="max-md:flex-col"
      title={title}
      closeLabel={PHOTO_GALLERY_TEXT.close}
      header={
        <div className="flex min-w-0 items-center gap-3 max-md:gap-2 max-md:[&>img]:hidden">
          <BrandLogo variant="dark" size={18} className="h-[18px] w-[24px]" />
          <DialogTitle className="truncate text-[15px] text-white">{title}</DialogTitle>
          <DialogDescription tone="inverse" className="mt-0 flex-none text-[12px] tnum">
            {PHOTO_GALLERY_TEXT.count(index, photos.length)}
          </DialogDescription>
        </div>
      }
    >
      <GalleryRail photos={photos} index={index} onSelect={onSelect} />

      <div
        {...swipe}
        className="relative flex min-w-0 flex-1 touch-pan-y items-center justify-center p-3 max-md:min-h-0 md:p-5"
      >
        {several ? (
          <GalleryArrow
            direction="previous"
            placement="stage"
            label={PHOTO_GALLERY_TEXT.previous}
            onClick={() => onStep(-1)}
          />
        ) : null}

        <div
          ref={zoom.frameRef}
          {...zoom.handlers}
          className={cn(
            'aspect-[4/3] max-h-full w-[min(100%,1100px,calc((100dvh_-_94px)*4/3))] max-w-full touch-none overflow-hidden border border-white/15 bg-[#151a23] select-none',
            zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
          )}
        >
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt}
              draggable={false}
              style={{ transform: zoomTransform(zoom.view) }}
              className={cn(
                'h-full w-full object-contain will-change-transform',
                zoom.smooth && 'transition-transform duration-200 ease-out',
              )}
            />
          ) : null}
        </div>

        <GalleryZoomControls scale={zoom.view.scale} onZoom={act} />

        {several ? (
          <GalleryArrow
            direction="next"
            placement="stage"
            label={PHOTO_GALLERY_TEXT.next}
            onClick={() => onStep(1)}
          />
        ) : null}

        <p
          aria-live="polite"
          className="absolute inset-x-0 bottom-[14px] px-12 text-center text-[12px] text-white/70 [overflow-wrap:anywhere]"
        >
          {current ? captionOf(current) : null}
        </p>
      </div>
    </Dialog>
  );
}
