export interface GalleryPhoto {
  url: string;
  alt: string;
  caption?: string | null;
}

export interface PhotoGalleryProps {
  title: string;
  photos: readonly GalleryPhoto[];
  startIndex?: number;
  strip?: boolean;
  stageClassName?: string;
  emptyLabel?: string;
}

export type GalleryStep = -1 | 1;
