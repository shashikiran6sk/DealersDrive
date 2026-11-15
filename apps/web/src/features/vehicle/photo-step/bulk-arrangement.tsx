'use client';

import {
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';

import { shotImage } from '@/components/vehicle/photo-standard';

import { ArrangementCell } from './arrangement-cell';
import type { Arrangement, ArrangementPosition } from './arrangement';
import { PHOTO_STEP_TEXT } from './photo-step.constants';

export interface BulkArrangementProps {
  arrangement: Arrangement;
  photos: DealerVehiclePhotos;
  selected: ArrangementPosition | null;
  failed: ReadonlySet<string>;
  disabled: boolean;
  onPress: (position: ArrangementPosition) => void;
  onRemove: (id: string) => void;
}

function same(a: ArrangementPosition | null, b: ArrangementPosition): boolean {
  return a !== null && a.area === b.area && a.index === b.index;
}

export function BulkArrangement({
  arrangement,
  photos,
  selected,
  failed,
  disabled,
  onPress,
  onRemove,
}: BulkArrangementProps) {
  const moving = selected !== null;
  const extrasRoom = Math.max(0, photos.extrasMax - photos.extras.length);
  const extraTargets = moving && arrangement.extras.length < extrasRoom;
  return (
    <div className="flex flex-col gap-[14px]">
      <ol className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 md:grid-cols-5">
        {STANDARD_PHOTO_SLOTS.map((slot, index) => {
          const position: ArrangementPosition = { area: 'slot', index };
          const label = PHOTO_STEP_TEXT.cellPosition(index + 1, PHOTO_SLOT_LABELS[slot]);
          const local = arrangement.slots[index] ?? null;
          const uploaded = photos.slots.find((one) => one.slot === slot)?.photo ?? null;
          return (
            <li key={slot}>
              <ArrangementCell
                position={label}
                photoUrl={local?.previewUrl ?? uploaded?.url ?? null}
                exampleUrl={shotImage(index + 1, 'result')}
                state={local ? 'local' : uploaded ? 'uploaded' : 'empty'}
                selected={same(selected, position)}
                moveTarget={moving}
                failed={local !== null && failed.has(local.id)}
                disabled={disabled}
                onPress={() => onPress(position)}
                onRemove={local ? () => onRemove(local.id) : undefined}
              />
            </li>
          );
        })}
      </ol>
      <section className="flex flex-col gap-[8px]">
        <h4 className="text-[14px]">{PHOTO_STEP_TEXT.arrangeExtras}</h4>
        {arrangement.extras.length === 0 && photos.extras.length === 0 && !extraTargets ? (
          <p className="text-[12px] ink-muted">{PHOTO_STEP_TEXT.arrangeExtrasEmpty}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-[10px] sm:grid-cols-4 md:grid-cols-6">
            {photos.extras.map((photo, index) => (
              <li key={photo.mediaId}>
                <ArrangementCell
                  position={PHOTO_STEP_TEXT.extraPosition(index + 1)}
                  photoUrl={photo.url}
                  exampleUrl={null}
                  state="uploaded"
                  selected={false}
                  moveTarget={false}
                  failed={false}
                  disabled
                  onPress={() => undefined}
                />
              </li>
            ))}
            {arrangement.extras.map((photo, index) => {
              const position: ArrangementPosition = { area: 'extra', index };
              return (
                <li key={photo.id}>
                  <ArrangementCell
                    position={PHOTO_STEP_TEXT.extraPosition(photos.extras.length + index + 1)}
                    photoUrl={photo.previewUrl}
                    exampleUrl={null}
                    state="local"
                    selected={same(selected, position)}
                    moveTarget={moving}
                    failed={failed.has(photo.id)}
                    disabled={disabled}
                    onPress={() => onPress(position)}
                    onRemove={() => onRemove(photo.id)}
                  />
                </li>
              );
            })}
            {extraTargets ? (
              <li>
                <ArrangementCell
                  position={PHOTO_STEP_TEXT.extraPosition(
                    photos.extras.length + arrangement.extras.length + 1,
                  )}
                  photoUrl={null}
                  exampleUrl={null}
                  state="empty"
                  selected={false}
                  moveTarget
                  failed={false}
                  disabled={disabled}
                  onPress={() => onPress({ area: 'extra', index: arrangement.extras.length })}
                />
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
