export interface GalleryPhoto {
  url: string;
  alt: string;
  caption?: string | null;
}

export interface GalleryFallbackImage {
  src: string;
  alt: string;
}

export interface PhotoGalleryProps {
  title: string;
  photos: readonly GalleryPhoto[];
  startIndex?: number;
  strip?: boolean;
  stageClassName?: string;
  emptyLabel?: string;
  fallback?: GalleryFallbackImage;
}

export type GalleryStep = -1 | 1;
