import { env } from '../../config/env.js';

/** The widths the processor writes, and therefore the widths a srcset may name. */
export const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const;

/**
 * The public URL of a processed image.
 *
 * Five modules render images — search, vehicles, enquiries, admin and now the
 * public dealer pages — so this cannot live inside any one of them
 * (ARCHITECTURE §5.5 rule 3). It is also the single place that knows the URL
 * *shape*: media is addressed by id and width, never by storage key, so the
 * bucket layout can change without invalidating a single cached page.
 *
 * The path used to read `/vehicles/by-media/…`, from the days when a vehicle
 * photograph was the only kind there was. A dealership's yard photograph is
 * delivered by the same route and the same handler, and a cover image whose URL
 * claims to be a vehicle's is the sort of thing somebody later writes a second
 * route to avoid. Renamed now rather than later, while nothing has cached one:
 * there are no vehicles on the platform until F055, and `media.get()` is the
 * only other caller.
 */
export function mediaUrl(mediaId: string, width: number): string {
  return `${env.MEDIA_BASE_URL}/by-media/${mediaId}/${width}.webp`;
}

export function srcsetFor(mediaId: string): string {
  return DERIVATIVE_WIDTHS.map((width) => `${mediaUrl(mediaId, width)} ${width}w`).join(', ');
}
