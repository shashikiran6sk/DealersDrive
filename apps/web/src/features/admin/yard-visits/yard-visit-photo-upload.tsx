'use client';

import { YARD_VISIT_PHOTO_LIMIT, YARD_VISIT_PHOTO_MIME_TYPES } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { failureMessage, fileRejection } from '@/lib/upload';

import { YARD_VISIT_PHOTO_RULE, YARD_VISITS_TEXT } from './yard-visits.constants';
import { uploadYardVisitPhoto } from './utils';

export interface YardVisitPhotoUploadProps {
  dealerId: string;
  visitId: string;
  dateLabel: string;
  photoCount: number;
}

export function YardVisitPhotoUpload({
  dealerId,
  visitId,
  dateLabel,
  photoCount,
}: YardVisitPhotoUploadProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (photoCount >= YARD_VISIT_PHOTO_LIMIT) {
    return (
      <p className="text-[12px] ink-muted">{YARD_VISITS_TEXT.photoLimit(YARD_VISIT_PHOTO_LIMIT)}</p>
    );
  }

  async function upload(file: File): Promise<void> {
    setError(null);
    const rejection = fileRejection(file, YARD_VISIT_PHOTO_RULE);
    if (rejection) {
      setError(rejection);
      return;
    }
    setBusy(true);
    try {
      await uploadYardVisitPhoto(dealerId, visitId, file);
      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, YARD_VISITS_TEXT.uploadFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={YARD_VISIT_PHOTO_MIME_TYPES.join(',')}
        aria-label={YARD_VISITS_TEXT.photoInputLabel(dateLabel)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn-ghost self-start text-[12px]"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? YARD_VISITS_TEXT.uploading : YARD_VISITS_TEXT.addPhoto}
      </button>
      {error ? (
        <p role="alert" className="text-[12px] text-(--color-err)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
