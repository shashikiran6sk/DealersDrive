import type { GalleryPhoto } from './photo-gallery.types';

export function preloadPhoto(photo: GalleryPhoto, sizes: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  if (photo.srcset) {
    image.sizes = sizes;
    image.srcset = photo.srcset;
  }
  image.src = photo.url;
  if (typeof image.decode === 'function') image.decode().catch(() => undefined);
  return image;
}
