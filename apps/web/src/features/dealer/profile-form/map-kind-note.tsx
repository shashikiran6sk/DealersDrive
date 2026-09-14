import type { MapKind } from '@dealers-drive/contracts';

import { PROFILE_FORM_TEXT } from './profile-form.constants';

const NOTE: Record<MapKind, { tone: string; text: string }> = {
  PLACE: { tone: 'text-(--color-ok)', text: PROFILE_FORM_TEXT.mapPlace },
  POINT: { tone: 'text-(--color-warn)', text: PROFILE_FORM_TEXT.mapPoint },
  NONE: { tone: 'text-(--color-warn)', text: PROFILE_FORM_TEXT.mapNone },
};

export function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind }) {
  if (!mapsUrl) return null;

  const note = NOTE[kind];
  return <p className={`mt-[6px] text-[11px] ${note.tone}`}>{note.text}</p>;
}
