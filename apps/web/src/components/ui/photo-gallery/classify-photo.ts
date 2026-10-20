import { STUDIO_BACKDROP } from './photo-gallery.constants';
import type { PhotoKind } from './photo-gallery.types';
import { cornerKind } from './utils';

export function classifyPhoto(image: HTMLImageElement): PhotoKind | null {
  if (!image.complete || image.naturalWidth === 0) return null;
  const edge = STUDIO_BACKDROP.sampleEdge;
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, edge, edge);
    return cornerKind(context.getImageData(0, 0, edge, edge).data, edge);
  } catch {
    return null;
  }
}
