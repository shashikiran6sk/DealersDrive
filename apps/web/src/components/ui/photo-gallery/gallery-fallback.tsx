'use client';

import Image from 'next/image';
import { useState } from 'react';

import { Blueprint, ImageSlot, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { FALLBACK_SIZES } from './photo-gallery.constants';
import type { GalleryFallbackImage } from './photo-gallery.types';

export interface GalleryFallbackProps {
  label: string;
  stageClassName: string;
  fallback?: GalleryFallbackImage;
}

export function GalleryFallback({ label, stageClassName, fallback }: GalleryFallbackProps) {
  const [failed, setFailed] = useState(false);
  const showImage = fallback !== undefined && !failed;

  return (
    <Blueprint className={cn('bg-(--color-surface)', stageClassName)}>
      {showImage ? (
        <>
          <Image
            src={fallback.src}
            alt={fallback.alt}
            fill
            priority
            unoptimized
            sizes={FALLBACK_SIZES}
            className="object-cover"
            onError={() => setFailed(true)}
          />
          <Tag className="absolute right-[10px] bottom-[10px] z-[3] bg-white text-[11px]">
            {label}
          </Tag>
        </>
      ) : (
        <ImageSlot label={label} />
      )}
    </Blueprint>
  );
}
