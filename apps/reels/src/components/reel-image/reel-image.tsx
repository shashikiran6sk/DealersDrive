import type { CSSProperties } from 'react';
import { Img, staticFile } from 'remotion';

import { COLORS } from '../../reel/reel.constants';

export type ReelImageProps = {
  src: string | null;
  fit: 'contain' | 'cover';
  style?: CSSProperties;
};

export function resolveSrc(src: string): string {
  return /^(https?:|data:)/.test(src) ? src : staticFile(src);
}

export function ReelImage({ src, fit, style }: ReelImageProps) {
  if (src === null) {
    return <div style={{ backgroundColor: COLORS.rule, ...style }} />;
  }
  return <Img src={resolveSrc(src)} maxRetries={3} style={{ objectFit: fit, ...style }} />;
}
