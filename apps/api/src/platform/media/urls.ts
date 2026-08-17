import { env } from '../../config/env.js';

/** The widths the processor writes, and therefore the widths a srcset may name. */
export const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const;

/**
 * The public URL of a processed image.
 *
 * Four modules render images — search, vehicles, enquiries and admin — so this
 * cannot live inside any one of them (ARCHITECTURE §5.5 rule 3). It is also the
 * single place that knows the URL *shape*: media is addressed by id and width,
 * never by storage key, so the bucket layout can change without invalidating a
 * single cached page.
 */
export function mediaUrl(mediaId: string, width: number): string {
  return `${env.MEDIA_BASE_URL}/vehicles/by-media/${mediaId}/${width}.webp`;
}

export function srcsetFor(mediaId: string): string {
  return DERIVATIVE_WIDTHS.map((width) => `${mediaUrl(mediaId, width)} ${width}w`).join(', ');
}
