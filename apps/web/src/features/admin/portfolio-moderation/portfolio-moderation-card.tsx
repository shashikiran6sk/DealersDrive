'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, StatusTag, Tag } from '@/components/ui/primitives';
import {
  approvePortfolioPhotoAction,
  rejectPortfolioPhotoAction,
  type PortfolioActionResult,
} from '@/features/admin/portfolio-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import {
  MIN_PORTFOLIO_REASON,
  PORTFOLIO_MODERATION_TEXT,
  PORTFOLIO_MODERATION_TONE,
} from './portfolio-moderation.constants';
import type { PortfolioModerationCardProps } from './portfolio-moderation.types';
import { PortfolioPreview } from './portfolio-preview';
import { formatReviewTime } from './utils';

export function PortfolioModerationCard({ photo }: PortfolioModerationCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const reasonId = `portfolio-reason-${photo.id}`;
  const isReplacement = photo.replacesId !== null;
  const decidable = photo.status === 'PENDING';
  const status = photo.status === 'REJECTED' ? 'REJECTED' : 'PENDING';

  function decide(work: () => Promise<PortfolioActionResult>): void {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setMessage(result.message ?? PORTFOLIO_MODERATION_TEXT.decisionFailed);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="card flex flex-col gap-3 bg-white p-4">
      <div className="flex flex-wrap items-center gap-[10px]">
        <Link
          href={`/admin/dealers/${photo.dealerId}`}
          className="text-[15px] font-extrabold [overflow-wrap:anywhere]"
        >
          {photo.dealerName}
        </Link>
        <StatusTag tone={PORTFOLIO_MODERATION_TONE[status]}>
          {PORTFOLIO_MODERATION_TEXT.statusLabel[status]}
        </StatusTag>
        {isReplacement ? (
          <Tag variant="neutral" className="text-[11px]">
            {PORTFOLIO_MODERATION_TEXT.replacement}
          </Tag>
        ) : null}
        <span className="ml-auto text-[12px] ink-muted tnum">
          {photo.reviewedAt && photo.status === 'REJECTED'
            ? PORTFOLIO_MODERATION_TEXT.reviewed(formatReviewTime(photo.reviewedAt))
            : PORTFOLIO_MODERATION_TEXT.submitted(formatReviewTime(photo.submittedAt))}
        </span>
      </div>

      {message ? <Banner tone="err">{message}</Banner> : null}

      {isReplacement ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PortfolioPreview
            url={photo.replacesPreviewUrl}
            alt={PORTFOLIO_MODERATION_TEXT.liveAlt(photo.dealerName)}
            label={PORTFOLIO_MODERATION_TEXT.liveNow}
            fallback={PORTFOLIO_MODERATION_TEXT.liveGone}
          />
          <PortfolioPreview
            url={photo.previewUrl}
            alt={PORTFOLIO_MODERATION_TEXT.proposedAlt(photo.dealerName)}
            label={PORTFOLIO_MODERATION_TEXT.proposed}
            fallback={PORTFOLIO_MODERATION_TEXT.noPreview}
          />
        </div>
      ) : (
        <div className="max-w-[420px]">
          <PortfolioPreview
            url={photo.previewUrl}
            alt={PORTFOLIO_MODERATION_TEXT.proposedAlt(photo.dealerName)}
            label={PORTFOLIO_MODERATION_TEXT.submittedPhoto}
            fallback={PORTFOLIO_MODERATION_TEXT.noPreview}
          />
        </div>
      )}

      <div>
        <div className="eyebrow">{PORTFOLIO_MODERATION_TEXT.captionLabel}</div>
        <p
          className={
            photo.caption
              ? 'mt-[4px] text-[13px] [overflow-wrap:anywhere]'
              : 'mt-[4px] text-[13px] ink-faint'
          }
        >
          {photo.caption ?? PORTFOLIO_MODERATION_TEXT.noCaption}
        </p>
      </div>

      {photo.status === 'REJECTED' && photo.rejectionReason ? (
        <p className="text-[13px] ink-secondary">
          {PORTFOLIO_MODERATION_TEXT.reasonGiven(photo.rejectionReason)}
        </p>
      ) : null}

      {!decidable ? null : rejecting ? (
        <div className="flex flex-col gap-2">
          <Field
            id={reasonId}
            label={PORTFOLIO_MODERATION_TEXT.reasonLabel}
            hint={PORTFOLIO_MODERATION_TEXT.reasonHint}
          >
            <Input
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={PORTFOLIO_MODERATION_TEXT.reasonPlaceholder}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              disabled={pending || reason.trim().length < MIN_PORTFOLIO_REASON}
              onClick={() =>
                decide(() => rejectPortfolioPhotoAction(photo.id, reason, photo.dealerSlug))
              }
            >
              {PORTFOLIO_MODERATION_TEXT.reject}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              {PORTFOLIO_MODERATION_TEXT.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => decide(() => approvePortfolioPhotoAction(photo.id, photo.dealerSlug))}
          >
            {PORTFOLIO_MODERATION_TEXT.approve}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setRejecting(true)}
          >
            {PORTFOLIO_MODERATION_TEXT.rejectOpen}
          </Button>
        </div>
      )}
    </li>
  );
}
