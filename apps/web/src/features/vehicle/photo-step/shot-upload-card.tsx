'use client';

import type { DealerSubmissionPhoto } from '@dealers-drive/contracts';

import {
  GuideImage,
  ShotFacts,
  ShotHeading,
  ShotIllustration,
  ShotInstructions,
  shotImage,
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
      id={`upload-shot-${String(shot.number)}`}
      className={cn(
        'card flex scroll-mt-24 flex-col gap-3 p-[14px]',
        photo ? 'border-(--color-ok)' : '',
      )}
    >
      <ShotHeading shot={shot} as="h4" />
      <div className="grid gap-[14px] sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ShotIllustration shot={shot} compact />
        <div className="flex flex-col gap-2">
          <PhotoUploadTile
            label={`${shot.title} · ${shot.side}`}
            photo={photo}
            busy={busy}
            editable={editable}
            onFile={onFile}
          />
          {error ? <p className="text-[12px] text-(--color-err)">{error}</p> : null}
          {photo ? null : (
            <figure className="m-0 flex items-center gap-2">
              <GuideImage
                src={shotImage(shot.number, 'result')}
                alt={PHOTO_STEP_TEXT.aimForAlt(shot.title)}
                className="aspect-[4/3] w-[96px] flex-none object-contain"
              />
              <figcaption className="text-[12px] ink-muted">{PHOTO_STEP_TEXT.aimFor}</figcaption>
            </figure>
          )}
        </div>
      </div>
      <ShotFacts shot={shot} />
      <details className="text-[13px]" open={!photo}>
        <summary className="cursor-pointer font-medium">{PHOTO_STEP_TEXT.howToShoot}</summary>
        <div className="pt-3">
          <ShotInstructions shot={shot} />
        </div>
      </details>
    </li>
  );
}
