import {
  STANDARD_PHOTO_SLOTS,
  type StandardPhotoSlot,
  type VehiclePhotoSlot,
} from '@dealers-drive/contracts';

export interface LocalPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

export interface Arrangement {
  slots: readonly (LocalPhoto | null)[];
  extras: readonly LocalPhoto[];
}

export interface ArrangementPosition {
  area: 'slot' | 'extra';
  index: number;
}

export interface ArrangeResult {
  arrangement: Arrangement;
  leftOut: LocalPhoto[];
}

export const EMPTY_ARRANGEMENT: Arrangement = {
  slots: STANDARD_PHOTO_SLOTS.map(() => null),
  extras: [],
};

export function arrange(
  current: Arrangement,
  incoming: readonly LocalPhoto[],
  uploaded: ReadonlySet<VehiclePhotoSlot>,
  extrasRoom: number,
): ArrangeResult {
  const slots = [...current.slots];
  const extras = [...current.extras];
  const leftOut: LocalPhoto[] = [];
  for (const photo of incoming) {
    const free = STANDARD_PHOTO_SLOTS.findIndex(
      (slot, index) => !uploaded.has(slot) && slots[index] === null,
    );
    if (free >= 0) slots[free] = photo;
    else if (extras.length < extrasRoom) extras.push(photo);
    else leftOut.push(photo);
  }
  return { arrangement: { slots, extras }, leftOut };
}

function at(arrangement: Arrangement, position: ArrangementPosition): LocalPhoto | null {
  return position.area === 'slot'
    ? (arrangement.slots[position.index] ?? null)
    : (arrangement.extras[position.index] ?? null);
}

function placed(
  slots: (LocalPhoto | null)[],
  extras: (LocalPhoto | null)[],
  position: ArrangementPosition,
  photo: LocalPhoto | null,
): void {
  if (position.area === 'slot') slots[position.index] = photo;
  else extras[position.index] = photo;
}

export function swap(
  arrangement: Arrangement,
  from: ArrangementPosition,
  to: ArrangementPosition,
): Arrangement {
  const slots = [...arrangement.slots];
  const extras: (LocalPhoto | null)[] = [...arrangement.extras];
  const moving = at(arrangement, from);
  const displaced = at(arrangement, to);
  placed(slots, extras, to, moving);
  placed(slots, extras, from, displaced);
  return { slots, extras: extras.filter((photo): photo is LocalPhoto => photo !== null) };
}

export function without(arrangement: Arrangement, id: string): Arrangement {
  return {
    slots: arrangement.slots.map((photo) => (photo?.id === id ? null : photo)),
    extras: arrangement.extras.filter((photo) => photo.id !== id),
  };
}

export function localPhotos(arrangement: Arrangement): LocalPhoto[] {
  return [
    ...arrangement.slots.filter((photo): photo is LocalPhoto => photo !== null),
    ...arrangement.extras,
  ];
}

export function uploadQueue(
  arrangement: Arrangement,
): { slot: VehiclePhotoSlot; photo: LocalPhoto }[] {
  const standard = STANDARD_PHOTO_SLOTS.flatMap((slot, index) => {
    const photo = arrangement.slots[index];
    return photo ? [{ slot, photo }] : [];
  });
  return [...standard, ...arrangement.extras.map((photo) => ({ slot: 'EXTRA' as const, photo }))];
}

export function stillMissing(
  arrangement: Arrangement,
  uploaded: ReadonlySet<VehiclePhotoSlot>,
): StandardPhotoSlot[] {
  return STANDARD_PHOTO_SLOTS.filter(
    (slot, index) => !uploaded.has(slot) && arrangement.slots[index] === null,
  );
}
