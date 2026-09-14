import type { MapKind } from '@dealers-drive/contracts';

import { PROFILE_FORM_TEXT } from './profile-form.constants';

const NOTE: Record<MapKind, { tone: string; text: string }> = {
  PLACE: { tone: 'text-(--color-ok)', text: PROFILE_FORM_TEXT.mapPlace },
  POINT: { tone: 'text-(--color-warn)', text: PROFILE_FORM_TEXT.mapPoint },
  NONE: { tone: 'text-(--color-warn)', text: PROFILE_FORM_TEXT.mapNone },
};

/**
 * What the saved link is actually drawing, in words (**R20**).
 *
 * A dealer pastes a URL into a box and never sees the map it produces, and the
 * difference between the two kinds of link is invisible in the box:
 *
 *   `PLACE`  the frame is their Google listing — name, address, rating
 *   `POINT`  a correctly-placed pin that names nothing
 *   `NONE`   a link we could not read a position out of at all
 *
 * `POINT` is the case this exists for, and it is not rare: the Share sheet on a
 * phone hands out a short link, and whether it resolves to a *place* depends on
 * whether the dealer opened their business's card before sharing. Both look
 * identical afterwards. `NONE` with no link at all says nothing.
 *
 * **R27 changed what these say to do.** The link is read-only now, so "share your
 * business from Google Maps again" is advice a dealer cannot act on; the
 * diagnosis stays and the remedy is support.
 */
export function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind }) {
  if (!mapsUrl) return null;

  const note = NOTE[kind];
  return <p className={`mt-[6px] text-[11px] ${note.tone}`}>{note.text}</p>;
}
