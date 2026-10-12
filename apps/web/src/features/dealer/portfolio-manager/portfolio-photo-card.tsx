'use client';

import { PORTFOLIO_PHOTO_STATUS_LABELS, type DealerPortfolioPhoto } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';
import { Banner, ImageSlot, StatusTag } from '@/components/ui/primitives';

import { PORTFOLIO_STATUS_TONE, PORTFOLIO_TEXT } from './portfolio-manager.constants';
import type { PortfolioPhotoCardProps } from './portfolio-manager.types';
import { PortfolioRemoveDialog } from './portfolio-remove-dialog';
import { PortfolioUploadDialog } from './portfolio-upload-dialog';

function removeDescription(photo: DealerPortfolioPhoto, replacementPending: boolean): string {
  if (photo.status === 'APPROVED') {
    return replacementPending
      ? PORTFOLIO_TEXT.removeApprovedWithReplacement
      : PORTFOLIO_TEXT.removeApproved;
  }
  return photo.status === 'PENDING' ? PORTFOLIO_TEXT.removePending : PORTFOLIO_TEXT.removeRejected;
}

export function PortfolioPhotoCard({
  photo,
  position,
  replacesPosition,
  replacementPending,
  onReplace,
  onRemove,
}: PortfolioPhotoCardProps) {
  const label = PORTFOLIO_TEXT.photoLabel(position);
  const canReplace = photo.status === 'APPROVED' && !replacementPending;

  return (
    <li className="card flex flex-col gap-[10px] bg-white p-[12px]" aria-label={label}>
      <div className="aspect-[4/3] overflow-hidden border border-(--color-divider) bg-(--color-surface)">
        {photo.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.previewUrl}
            alt={PORTFOLIO_TEXT.previewAlt(position, photo.caption)}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageSlot label={PORTFOLIO_TEXT.noPreview} className="h-full w-full" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[13px] font-extrabold">{label}</span>
        <StatusTag tone={PORTFOLIO_STATUS_TONE[photo.status]}>
          {PORTFOLIO_PHOTO_STATUS_LABELS[photo.status]}
        </StatusTag>
      </div>

      {photo.replacesId !== null && photo.status === 'PENDING' ? (
        <p className="text-[12px] ink-secondary">{PORTFOLIO_TEXT.replaces(replacesPosition)}</p>
      ) : null}
      {replacementPending ? (
        <p className="text-[12px] ink-secondary">{PORTFOLIO_TEXT.replacementWaiting}</p>
      ) : null}

      <p
        className={photo.caption ? 'text-[13px] [overflow-wrap:anywhere]' : 'text-[13px] ink-faint'}
      >
        {photo.caption ?? PORTFOLIO_TEXT.noCaption}
      </p>

      {photo.status === 'REJECTED' ? (
        <Banner tone="err">
          {photo.rejectionReason
            ? PORTFOLIO_TEXT.rejectedBecause(photo.rejectionReason)
            : PORTFOLIO_TEXT.rejectedNoReason}
        </Banner>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-[8px]">
        {canReplace ? (
          <PortfolioUploadDialog
            title={PORTFOLIO_TEXT.replaceTitle(position)}
            description={PORTFOLIO_TEXT.replaceDescription}
            onSubmit={onReplace}
            trigger={
              <Button
                variant="secondary"
                size="sm"
                aria-label={PORTFOLIO_TEXT.replaceLabel(position)}
              >
                {PORTFOLIO_TEXT.replace}
              </Button>
            }
          />
        ) : null}
        <PortfolioRemoveDialog
          title={PORTFOLIO_TEXT.removeTitle(position)}
          description={removeDescription(photo, replacementPending)}
          onConfirm={onRemove}
          trigger={
            <Button variant="ghost" size="sm" aria-label={PORTFOLIO_TEXT.removeLabel(position)}>
              {PORTFOLIO_TEXT.remove}
            </Button>
          }
        />
      </div>
    </li>
  );
}
