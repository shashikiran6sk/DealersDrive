export interface GalleryPhoto {
  url: string;
  alt: string;
  caption?: string | null;
}

export interface GalleryFallbackImage {
  src: string;
  alt: string;
}

export type PhotoGalleryVariant = 'cover' | 'studio';

export interface PhotoGalleryProps {
  title: string;
  photos: readonly GalleryPhoto[];
  startIndex?: number;
  strip?: boolean;
  stageClassName?: string;
  emptyLabel?: string;
  fallback?: GalleryFallbackImage;
  variant?: PhotoGalleryVariant;
}

export type GalleryStep = -1 | 1;

export type PhotoKind = 'studio' | 'photo';

export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ZoomAction = 'in' | 'out' | 'reset';

export interface Tap {
  time: number;
  x: number;
  y: number;
}
