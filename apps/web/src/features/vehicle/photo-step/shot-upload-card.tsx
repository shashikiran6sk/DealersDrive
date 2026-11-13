'use client';

import type { DealerSubmissionPhoto } from '@dealers-drive/contracts';

import {
  ShotIllustration,
  ShotInstructions,
  type ShotGuide,
} from '@/components/vehicle/photo-standard';
import { cn } from '@/lib/cn';

import { PhotoUploadTile } from './photo-upload-tile';
import { PHOTO_STEP_TEXT } from './photo-step.constants';

export interface ShotUploadCardProps {
  shot: ShotGuide;
  photo: DealerSubmissionPhoto | null;
  busy: boolean;
  editable: boolean;
  error?: string | null;
  onFile: (file: File) => void;
}

export function ShotUploadCard({
  shot,
  photo,
  busy,
  editable,
  error = null,
  onFile,
}: ShotUploadCardProps) {
  return (
    <li
      className={cn(
        'card grid gap-[14px] p-[14px] sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]',
        photo ? 'border-(--color-ok)' : '',
      )}
    >
      <div className="flex flex-col gap-2">
        <h4 className="flex items-baseline gap-2 text-[16px]">
          <span className="tnum ink-muted">{PHOTO_STEP_TEXT.shotLabel(shot.number)}</span>
          {shot.title}
          {photo ? (
            <span aria-hidden className="text-(--color-ok)">
              ✓
            </span>
          ) : null}
        </h4>
        <ShotIllustration shot={shot} />
        <details className="text-[13px]" open={!photo}>
          <summary className="cursor-pointer font-medium">{PHOTO_STEP_TEXT.howToShoot}</summary>
          <div className="pt-2">
            <ShotInstructions shot={shot} />
          </div>
        </details>
      </div>
      <div className="flex flex-col gap-2">
        <PhotoUploadTile
          label={shot.title}
          photo={photo}
          busy={busy}
          editable={editable}
          onFile={onFile}
        />
        {error ? <p className="text-[12px] text-(--color-err)">{error}</p> : null}
      </div>
    </li>
  );
}
