'use client';

import type { AdminSubmittedPhotos } from '@dealers-drive/contracts';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { submittedPhotosDownloadAction } from '@/features/admin/submitted-photos-actions';

import { SUBMITTED_PHOTOS_TEXT } from './listing-review.constants';
import { startDownload } from './utils';

export interface SubmittedPhotosPanelProps {
  listingId: string;
  photos: AdminSubmittedPhotos;
}

const ALL = 'all';

export function SubmittedPhotosPanel({ listingId, photos }: SubmittedPhotosPanelProps) {
  const dealerPlan = photos.plan === 'DEALER';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(mediaId?: string): Promise<void> {
    setBusy(mediaId ?? ALL);
    setError(null);
    const result = await submittedPhotosDownloadAction(listingId, mediaId);
    setBusy(null);
    if (result.ok) startDownload(result.url);
    else setError(result.message);
  }

  return (
    <section aria-labelledby="submitted-photos-heading" className="card gap-[10px] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="submitted-photos-heading" className="text-[16px]">
          {SUBMITTED_PHOTOS_TEXT.title}
        </h2>
        {photos.planLabel ? (
          <StatusTag tone={dealerPlan ? 'accent' : 'neutral'}>
            {dealerPlan ? SUBMITTED_PHOTOS_TEXT.planDealer : SUBMITTED_PHOTOS_TEXT.planStudio}
          </StatusTag>
        ) : null}
      </div>
      <p className="text-[13px] ink-body">
        {dealerPlan ? SUBMITTED_PHOTOS_TEXT.dealerSteps : SUBMITTED_PHOTOS_TEXT.studioSteps}
      </p>
      {photos.missing.length > 0 ? (
        <Banner tone="warn">{SUBMITTED_PHOTOS_TEXT.missing(photos.missing.length)}</Banner>
      ) : null}
      {error ? <Banner tone="err">{error}</Banner> : null}
      {photos.items.length === 0 ? (
        dealerPlan ? (
          <p className="text-[13px] ink-muted">{SUBMITTED_PHOTOS_TEXT.none}</p>
        ) : null
      ) : (
        <>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="primary"
              loading={busy === ALL}
              disabled={busy !== null}
              onClick={() => void download()}
            >
              {busy === ALL
                ? SUBMITTED_PHOTOS_TEXT.preparing
                : SUBMITTED_PHOTOS_TEXT.downloadAll(photos.items.length)}
            </Button>
            <span className="text-[11px] ink-muted">
              {SUBMITTED_PHOTOS_TEXT.zipHint(photos.archiveName)}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-[8px] sm:grid-cols-3">
            {photos.items.map((photo) => (
              <li
                key={photo.mediaId}
                className="flex min-w-0 flex-col gap-[4px] border border-(--color-divider) p-[6px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={SUBMITTED_PHOTOS_TEXT.alt(photo.slotLabel)}
                  className="aspect-[4/3] w-full object-cover"
                />
                <span className="truncate text-[12px] font-medium">{photo.slotLabel}</span>
                <span className="flex items-center justify-between gap-1 text-[11px] ink-muted">
                  {SUBMITTED_PHOTOS_TEXT.sizeLabel(photo.bytes)}
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === photo.mediaId}
                    disabled={busy !== null}
                    onClick={() => void download(photo.mediaId)}
                  >
                    {SUBMITTED_PHOTOS_TEXT.download}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
