'use client';

import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { useEffect, type ReactNode } from 'react';

import { Dialog } from '@/components/ui/dialog';

import { GalleryArrow } from './gallery-arrow';
import { VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';
import { arrowStep } from './utils';

export interface GalleryViewerProps {
  title: string;
  images: PublicVehicleImage[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStep: (delta: -1 | 1) => void;
  trigger: ReactNode;
}

export function GalleryViewer({
  title,
  images,
  index,
  open,
  onOpenChange,
  onStep,
  trigger,
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
      trigger={trigger}
      title={VEHICLE_GALLERY_TEXT.viewerTitle(title)}
      description={VEHICLE_GALLERY_TEXT.count(index, images.length)}
      closeLabel={VEHICLE_GALLERY_TEXT.close}
    >
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-3 md:p-5">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt}
            className="block max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>
      {several ? (
        <>
          <GalleryArrow direction="previous" size="lg" onClick={() => onStep(-1)} />
          <GalleryArrow direction="next" size="lg" onClick={() => onStep(1)} />
        </>
      ) : null}
    </Dialog>
  );
}
