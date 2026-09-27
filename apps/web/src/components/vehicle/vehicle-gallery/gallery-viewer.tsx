'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useEffect } from 'react';

import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';

import { GalleryArrow } from './gallery-arrow';
import { GalleryRail } from './gallery-rail';
import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { arrowStep } from './utils';

export interface GalleryViewerProps {
  title: string;
  images: PublicVehicleImage[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (index: number) => void;
  onStep: (delta: -1 | 1) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function GalleryViewer({
  title,
  images,
  index,
  open,
  onOpenChange,
  onSelect,
  onStep,
  onCloseAutoFocus,
}: GalleryViewerProps) {
  const current = images[index];
  const several = images.length > 1;

  useEffect(() => {
    if (!open || !several) return;
    function onKeyDown(event: KeyboardEvent) {
      const delta = arrowStep(event.key);
      if (delta === null) return;
      event.preventDefault();
      onStep(delta);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, several, onStep]);

  return (
    <Dialog
      variant="fullscreen"
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={title}
      closeLabel={VEHICLE_GALLERY_TEXT.close}
      header={
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex-none border border-white/40 px-[7px] py-[2px] font-mono text-[11px]"
          >
            {VEHICLE_GALLERY_TEXT.brand}
          </span>
          <DialogTitle className="truncate text-[15px] text-white">{title}</DialogTitle>
          <DialogDescription tone="inverse" className="mt-0 flex-none text-[12px] tnum">
            {VEHICLE_GALLERY_TEXT.count(index, images.length)}
          </DialogDescription>
        </div>
      }
    >
      <GalleryRail images={images} index={index} onSelect={onSelect} />

      <div className="relative flex min-w-0 flex-1 items-center justify-center p-3 md:p-5">
        {several ? (
          <GalleryArrow
            direction="previous"
            placement="stage"
            label={VEHICLE_GALLERY_TEXT.previous}
            onClick={() => onStep(-1)}
          />
        ) : null}

        <div className="aspect-[4/3] max-h-full w-[min(100%,1100px,calc((100dvh_-_94px)*4/3))] max-w-full border border-white/15 bg-[#151a23]">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt={current.alt} className="h-full w-full object-contain" />
          ) : null}
        </div>

        {several ? (
          <GalleryArrow
            direction="next"
            placement="stage"
            label={VEHICLE_GALLERY_TEXT.next}
            onClick={() => onStep(1)}
          />
        ) : null}

        <p
          aria-live="polite"
          className="absolute inset-x-0 bottom-[14px] px-12 text-center text-[12px] text-white/70"
        >
          {current?.alt}
        </p>
      </div>
    </Dialog>
  );
}
