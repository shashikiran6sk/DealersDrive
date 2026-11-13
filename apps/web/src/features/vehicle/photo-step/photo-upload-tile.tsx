'use client';

import type { DealerSubmissionPhoto } from '@dealers-drive/contracts';
import { useId, useRef } from 'react';

import { Button } from '@/components/ui/button';

import { PHOTO_ACCEPT, PHOTO_STEP_TEXT } from './photo-step.constants';

export interface PhotoUploadTileProps {
  label: string;
  photo: DealerSubmissionPhoto | null;
  busy: boolean;
  editable: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
}

export function PhotoUploadTile({
  label,
  photo,
  busy,
  editable,
  onFile,
  onRemove,
}: PhotoUploadTileProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-dashed border-(--color-accent-400) bg-(--color-accent-100)">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={PHOTO_STEP_TEXT.thumbnailAlt(label)}
            className="h-full w-full object-cover"
          />
        ) : (
          <label
            htmlFor={inputId}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-[13px] ink-muted"
          >
            <span aria-hidden className="text-[26px] leading-none">
              +
            </span>
            {busy ? PHOTO_STEP_TEXT.uploading : PHOTO_STEP_TEXT.upload}
          </label>
        )}
        {busy && photo ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[13px]">
            {PHOTO_STEP_TEXT.uploading}
          </span>
        ) : null}
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        disabled={!editable || busy}
        aria-label={`${PHOTO_STEP_TEXT.upload}: ${label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
      {photo && editable ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {PHOTO_STEP_TEXT.replace}
          </Button>
          {onRemove ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
              {PHOTO_STEP_TEXT.remove}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
