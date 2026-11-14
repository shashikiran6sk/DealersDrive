import { useEffect, useRef } from 'react';

import { preloadPhoto } from './preload-photo';
import type { GalleryPhoto } from './photo-gallery.types';
import { neighbourIndexes, saveDataRequested } from './utils';

export interface PreloadNeighbours {
  photos: readonly GalleryPhoto[];
  index: number;
  sizes: string;
  enabled: boolean;
}

export function usePreloadNeighbours({ photos, index, sizes, enabled }: PreloadNeighbours): void {
  const heldRef = useRef<ReadonlyMap<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (!enabled || saveDataRequested(window.navigator)) return;
    const held = heldRef.current;
    const kept = new Map<string, HTMLImageElement>();
    for (const at of neighbourIndexes(index, photos.length)) {
      const photo = photos[at];
      if (!photo) continue;
      kept.set(photo.url, held.get(photo.url) ?? preloadPhoto(photo, sizes));
    }
    heldRef.current = kept;
  }, [photos, index, sizes, enabled]);
}
