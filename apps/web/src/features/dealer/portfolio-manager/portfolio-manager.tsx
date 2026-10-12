'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, EmptyState } from '@/components/ui/primitives';
import { failureMessage } from '@/lib/upload';

import { PORTFOLIO_PATHS, PORTFOLIO_TEXT } from './portfolio-manager.constants';
import type { PortfolioManagerProps, PortfolioOutcome } from './portfolio-manager.types';
import { PortfolioPhotoCard } from './portfolio-photo-card';
import { PortfolioUploadDialog } from './portfolio-upload-dialog';
import {
  activeCount,
  pendingReplacementTargets,
  positionsOf,
  removePortfolioPhoto,
  submitPortfolioPhoto,
} from './utils';

export function PortfolioManager({ portfolio, paths = PORTFOLIO_PATHS }: PortfolioManagerProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const photos = portfolio.data;
  const used = activeCount(photos);
  const waiting = pendingReplacementTargets(photos);
  const positions = positionsOf(photos);

  async function submit(
    file: File,
    caption: string,
    replacesId?: string,
  ): Promise<PortfolioOutcome> {
    setNotice(null);
    try {
      await submitPortfolioPhoto(paths, file, replacesId ? { caption, replacesId } : { caption });
      setNotice(replacesId ? PORTFOLIO_TEXT.replacementSubmitted : PORTFOLIO_TEXT.submitted);
      router.refresh();
      return null;
    } catch (caught) {
      return failureMessage(caught, PORTFOLIO_TEXT.uploadFailed);
    }
  }

  async function remove(photoId: string): Promise<PortfolioOutcome> {
    setNotice(null);
    try {
      await removePortfolioPhoto(paths, photoId);
      setNotice(PORTFOLIO_TEXT.removed);
      router.refresh();
      return null;
    } catch (caught) {
      return failureMessage(caught, PORTFOLIO_TEXT.removeFailed);
    }
  }

  const addButton = (
    <PortfolioUploadDialog
      title={PORTFOLIO_TEXT.addTitle}
      description={PORTFOLIO_TEXT.addDescription}
      onSubmit={(file, caption) => submit(file, caption)}
      trigger={
        <Button variant="primary" disabled={!portfolio.canAdd}>
          {PORTFOLIO_TEXT.add}
        </Button>
      }
    />
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div className="min-w-0">
          <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{PORTFOLIO_TEXT.title}</h1>
          <p className="max-w-[64ch] text-[13px] ink-muted">{PORTFOLIO_TEXT.intro}</p>
        </div>
        <div className="flex flex-col items-end gap-[4px] max-sm:items-start">
          {addButton}
          <span className="text-[12px] ink-subtle tnum">
            {PORTFOLIO_TEXT.count(used, portfolio.limit)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[4px] border border-(--color-divider) bg-(--color-surface) px-[14px] py-[12px] text-[13px] leading-[1.55]">
        <p className="font-semibold">{PORTFOLIO_TEXT.moderation}</p>
        <p className="ink-secondary">{PORTFOLIO_TEXT.formats}</p>
      </div>

      {portfolio.canAdd ? null : (
        <Banner tone="warn">{PORTFOLIO_TEXT.full(portfolio.limit)}</Banner>
      )}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {photos.length === 0 ? (
        <EmptyState title={PORTFOLIO_TEXT.emptyTitle} message={PORTFOLIO_TEXT.emptyMessage} />
      ) : (
        <ul
          aria-label={PORTFOLIO_TEXT.listLabel}
          className="m-0 grid list-none gap-[12px] p-0 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]"
        >
          {photos.map((photo) => (
            <PortfolioPhotoCard
              key={photo.id}
              photo={photo}
              position={positions.get(photo.id) ?? 0}
              replacesPosition={
                photo.replacesId === null ? null : (positions.get(photo.replacesId) ?? null)
              }
              replacementPending={waiting.has(photo.id)}
              onReplace={(file, caption) => submit(file, caption, photo.id)}
              onRemove={() => remove(photo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
