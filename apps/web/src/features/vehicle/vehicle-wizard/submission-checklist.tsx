import type { DealerVehiclePhotos } from '@dealers-drive/contracts';
import Link from 'next/link';

import { ChecklistItem as Item } from './checklist-item';
import type { SubmissionNeeds } from './submission';
import { CHECKLIST_TEXT } from './vehicle-wizard.constants';

export interface SubmissionChecklistProps {
  needs: SubmissionNeeds;
  photos: DealerVehiclePhotos | null;
  photosHref: string;
}

export function SubmissionChecklist({ needs, photos, photosHref }: SubmissionChecklistProps) {
  if (!needs.photosShown) return null;
  return (
    <section
      className="rounded-[12px] border border-(--color-divider) p-[14px]"
      aria-labelledby="submission-checklist"
    >
      <h3 id="submission-checklist" className="mb-2 text-[15px]">
        {CHECKLIST_TEXT.title}
      </h3>
      <ul className="flex flex-col gap-2 text-[13px]">
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
      </ul>
    </section>
  );
}
