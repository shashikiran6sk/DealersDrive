import type { DealerVehiclePhotos } from '@dealers-drive/contracts';

import { CHECKLIST_TEXT } from './vehicle-wizard.constants';

export interface SubmissionNeeds {
  photosShown: boolean;
  photosReady: boolean;
}

export function submissionNeeds(photos: DealerVehiclePhotos | null): SubmissionNeeds {
  const photosShown = photos?.enabled === true;
  return { photosShown, photosReady: !photosShown || photos?.ready === true };
}

export function submissionBlocker(needs: SubmissionNeeds): string | null {
  return needs.photosReady ? null : CHECKLIST_TEXT.blockedPhotos;
}
