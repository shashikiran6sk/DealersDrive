import type { DealerVehiclePhotos } from '@dealers-drive/contracts';

import { PHOTO_STEP_TEXT } from './photo-step.constants';
import type { PhotoStepProps, PlanOption } from './photo-step.types';

export function planOptions(
  photos: DealerVehiclePhotos,
  billing: PhotoStepProps['billing'],
): PlanOption[] {
  const charge = billing?.enabled ? billing.costs : null;
  return [
    {
      plan: 'DEALER',
      title: PHOTO_STEP_TEXT.dealerTitle,
      body: PHOTO_STEP_TEXT.dealerBody,
      note: null,
      available: true,
      credits: charge ? charge.DEALER : null,
    },
    {
      plan: 'DEALERS_DRIVE',
      title: PHOTO_STEP_TEXT.studioTitle,
      body: PHOTO_STEP_TEXT.studioBody,
      note: photos.photoshoot.available
        ? PHOTO_STEP_TEXT.studioAvailable(photos.photoshoot.district)
        : PHOTO_STEP_TEXT.studioUnavailable(photos.photoshoot.district),
      available: photos.photoshoot.available,
      credits: charge ? charge.DEALERS_DRIVE : null,
    },
  ];
}
