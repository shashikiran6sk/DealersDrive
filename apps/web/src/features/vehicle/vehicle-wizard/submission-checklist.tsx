'use client';

import {
  creditsLabel,
  type BillingSummary,
  type CreditPacksResponse,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CreditPacks } from '@/features/dealer/billing';

import { ChecklistItem as Item } from './checklist-item';
import type { SubmissionNeeds } from './submission';
import { CHECKLIST_TEXT } from './vehicle-wizard.constants';

export interface SubmissionChecklistProps {
  needs: SubmissionNeeds;
  photos: DealerVehiclePhotos | null;
  billing: BillingSummary | null;
  packs: CreditPacksResponse | null;
  photosHref: string;
}

export function SubmissionChecklist({
  needs,
  photos,
  billing,
  packs,
  photosHref,
}: SubmissionChecklistProps) {
  const [buying, setBuying] = useState(false);
  if (!needs.photosShown && !needs.creditsShown) return null;
  return (
    <section
      className="rounded-[12px] border border-(--color-divider) p-[14px]"
      aria-labelledby="submission-checklist"
    >
      <h3 id="submission-checklist" className="mb-2 text-[15px]">
        {CHECKLIST_TEXT.title}
      </h3>
      <ul className="flex flex-col gap-2 text-[13px]">
        {needs.photosShown ? (
          <Item ok={needs.photosReady}>
            {photos?.plan === 'DEALERS_DRIVE' && needs.photosReady
              ? CHECKLIST_TEXT.photosPlanStudio
              : needs.photosReady
                ? CHECKLIST_TEXT.photosReady
                : CHECKLIST_TEXT.photosMissing}
            {needs.photosReady ? null : (
              <Link href={photosHref} className="font-medium underline">
                {CHECKLIST_TEXT.goToPhotos}
              </Link>
            )}
          </Item>
        ) : null}
        {needs.creditsShown ? (
          <Item ok={needs.creditsReady}>
            {needs.creditsNeeded === 0
              ? CHECKLIST_TEXT.creditsNone
              : CHECKLIST_TEXT.credits(
                  creditsLabel(needs.creditsNeeded),
                  creditsLabel(needs.creditsAvailable),
                )}
            {!needs.creditsReady && packs && !buying ? (
              <Button size="sm" variant="primary" onClick={() => setBuying(true)}>
                {CHECKLIST_TEXT.buyCredits}
              </Button>
            ) : null}
          </Item>
        ) : null}
        {needs.creditsShown && buying && packs ? (
          <li
            id="buy-credits-panel"
            aria-labelledby="buy-credits-title"
            className="mt-1 rounded-[10px] border border-(--color-divider) bg-(--color-bg) p-[12px]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 id="buy-credits-title" className="text-[14px]">
                  {CHECKLIST_TEXT.buyTitle}
                </h4>
                <p className="text-[12px] ink-muted">{CHECKLIST_TEXT.buyDescription}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setBuying(false)}>
                {CHECKLIST_TEXT.buyClose}
              </Button>
            </div>
            <CreditPacks
              packs={packs}
              canPurchase={billing?.canPurchase ?? false}
              onPurchased={() => setBuying(false)}
            />
          </li>
        ) : null}
      </ul>
      {needs.creditsShown ? (
        <p className="mt-2 text-[12px] ink-subtle">{CHECKLIST_TEXT.heldNote}</p>
      ) : null}
    </section>
  );
}
