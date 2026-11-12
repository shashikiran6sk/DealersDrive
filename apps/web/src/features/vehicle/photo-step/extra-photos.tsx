'use client';

import type { DealerSubmissionPhoto } from '@dealers-drive/contracts';

import { PhotoUploadTile } from './photo-upload-tile';
import { PHOTO_STEP_TEXT } from './photo-step.constants';

export interface ExtraPhotosProps {
  extras: readonly DealerSubmissionPhoto[];
  max: number;
  busyKey: string | null;
  editable: boolean;
  onAdd: (file: File) => void;
  onRemove: (mediaId: string) => void;
}

export function ExtraPhotos({ extras, max, busyKey, editable, onAdd, onRemove }: ExtraPhotosProps) {
  return (
    <section className="card flex flex-col gap-3 p-[16px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[16px]">{PHOTO_STEP_TEXT.extrasTitle}</h4>
        <span className="text-[12px] ink-muted tnum">
          {PHOTO_STEP_TEXT.extrasCount(extras.length, max)}
        </span>
      </div>
      <p className="text-[13px] ink-body">{PHOTO_STEP_TEXT.extrasBody}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {extras.map((photo) => (
          <li key={photo.mediaId}>
            <PhotoUploadTile
              label={photo.slotLabel}
              photo={photo}
              busy={busyKey === photo.mediaId}
              editable={editable}
              onFile={() => undefined}
              onRemove={() => onRemove(photo.mediaId)}
            />
          </li>
        ))}
        {editable && extras.length < max ? (
          <li>
            <PhotoUploadTile
              label={PHOTO_STEP_TEXT.addExtra}
              photo={null}
              busy={busyKey === 'EXTRA'}
              editable={editable}
              onFile={onAdd}
            />
          </li>
        ) : null}
      </ul>
    </section>
  );
}
