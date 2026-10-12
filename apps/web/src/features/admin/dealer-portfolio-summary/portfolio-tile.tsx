'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';
import { takeDownPortfolioPhotoAction } from '@/features/admin/portfolio-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import {
  DEALER_PORTFOLIO_TEXT,
  MIN_TAKE_DOWN_REASON,
  PORTFOLIO_STATUS_ADMIN_LABELS,
  PORTFOLIO_TONE,
} from './dealer-portfolio-summary.constants';
import type { PortfolioTileProps } from './dealer-portfolio-summary.types';

export function PortfolioTile({ photo, index, dealerSlug }: PortfolioTileProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function takeDown() {
    setError(null);
    startTransition(async () => {
      const result = await takeDownPortfolioPhotoAction(photo.id, reason.trim(), dealerSlug);
      if (!result.ok) {
        setError(result.message ?? DEALER_PORTFOLIO_TEXT.takeDownFailed);
        return;
      }
      setOpen(false);
      setReason('');
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 border border-(--color-divider) bg-white p-2 text-[12px]">
      {photo.previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photo.previewUrl}
          alt={photo.caption ?? DEALER_PORTFOLIO_TEXT.photoAlt(index)}
          className="h-[120px] w-full object-cover"
        />
      ) : (
        <div className="flex h-[120px] items-center justify-center border border-dashed border-(--color-divider) ink-faint">
          {DEALER_PORTFOLIO_TEXT.noPreview}
        </div>
      )}

      <StatusTag tone={PORTFOLIO_TONE[photo.status]} className="self-start">
        {PORTFOLIO_STATUS_ADMIN_LABELS[photo.status]}
      </StatusTag>

      {photo.caption ? <p className="ink-secondary">{photo.caption}</p> : null}
      {photo.replacesId ? <p className="ink-muted">{DEALER_PORTFOLIO_TEXT.replacement}</p> : null}
      {photo.rejectionReason ? (
        <p className="ink-muted">
          {DEALER_PORTFOLIO_TEXT.rejectedPrefix}
          {photo.rejectionReason}
        </p>
      ) : null}

      {photo.status === 'APPROVED' && !open ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>
          {DEALER_PORTFOLIO_TEXT.takeDown}
        </Button>
      ) : null}

      {photo.status === 'APPROVED' && open ? (
        <div className="flex flex-col gap-2">
          <Input
            aria-label={DEALER_PORTFOLIO_TEXT.reasonLabel(index)}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={DEALER_PORTFOLIO_TEXT.reasonPlaceholder}
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={pending}
              disabled={reason.trim().length < MIN_TAKE_DOWN_REASON}
              onClick={takeDown}
            >
              {DEALER_PORTFOLIO_TEXT.takeDownConfirm}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setReason('');
                setError(null);
              }}
            >
              {DEALER_PORTFOLIO_TEXT.cancel}
            </Button>
          </div>
          <p className="ink-muted">{DEALER_PORTFOLIO_TEXT.takeDownNote}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-(--color-err)">
          {error}
        </p>
      ) : null}
    </li>
  );
}
