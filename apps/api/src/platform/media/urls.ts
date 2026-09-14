import { env } from '../../config/env.js';

export const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const;

export function mediaUrl(mediaId: string, width: number): string {
  return `${env.MEDIA_BASE_URL}/by-media/${mediaId}/${width}.webp`;
}

export function srcsetFor(mediaId: string): string {
  return DERIVATIVE_WIDTHS.map((width) => `${mediaUrl(mediaId, width)} ${width}w`).join(', ');
}
