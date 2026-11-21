import {
  creditsLabel,
  type BillingSummary,
  type DealerVehicle,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';

import { CHECKLIST_TEXT } from './vehicle-wizard.constants';

export interface SubmissionNeeds {
  photosShown: boolean;
  photosReady: boolean;
  creditsShown: boolean;
  creditsNeeded: number;
  creditsAvailable: number;
  creditsReady: boolean;
}

export function submissionNeeds(
  vehicle: DealerVehicle,
  photos: DealerVehiclePhotos | null,
  billing: BillingSummary | null,
): SubmissionNeeds {
  const photosShown = photos?.enabled === true;
  const plan = photosShown ? (photos?.plan ?? null) : (vehicle.listing.photoPlan ?? null);
  const creditsShown = billing?.enabled === true;
  const cost = creditsShown && billing ? (plan ? billing.costs[plan] : billing.costs.UNPLANNED) : 0;
  const creditsNeeded = Math.max(0, cost - (vehicle.listing.creditsHeld ?? 0));
  const creditsAvailable = billing?.available ?? 0;
  return {
    photosShown,
    photosReady: !photosShown || photos?.ready === true,
    creditsShown,
    creditsNeeded,
    creditsAvailable,
    creditsReady: !creditsShown || creditsAvailable >= creditsNeeded,
  };
}

export function submissionBlocker(needs: SubmissionNeeds): string | null {
  if (!needs.photosReady) return CHECKLIST_TEXT.blockedPhotos;
  if (!needs.creditsReady) {
    return CHECKLIST_TEXT.blockedCredits(
      creditsLabel(needs.creditsNeeded - needs.creditsAvailable),
    );
  }
  return null;
}
