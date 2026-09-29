import type { ReactNode } from 'react';

export interface HeroImage {
  src: string;
  alt: string;
}

export interface HeroBannerProps {
  image: HeroImage | null;
  children: ReactNode;
}
