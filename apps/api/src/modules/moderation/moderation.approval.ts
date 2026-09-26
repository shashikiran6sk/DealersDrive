import {
  ListingCheckKey,
  vehicleIssues,
  type ApprovalBlocker,
  type DealerStatus,
} from '@dealers-drive/contracts';
import type { Vehicle } from '@prisma/client';

import { completenessOf } from '../vehicles/vehicles.facade.js';
import { BLOCKER_MESSAGES } from './moderation.messages.js';

export interface ApprovalState {
  dealerStatus: DealerStatus;
  vehicle: Vehicle;
  checkedKeys: readonly string[];
  imageCount: number;
  hasPrimary: boolean;
  minImages: number;
}

export function approvalBlockers(state: ApprovalState): ApprovalBlocker[] {
  const blockers: ApprovalBlocker[] = [];

  if (state.dealerStatus !== 'ACTIVE') {
    blockers.push({ code: 'DEALER_NOT_ACTIVE', message: BLOCKER_MESSAGES.DEALER_NOT_ACTIVE });
  }
  if (vehicleIssues(completenessOf(state.vehicle)).length > 0) {
    blockers.push({ code: 'VEHICLE_INCOMPLETE', message: BLOCKER_MESSAGES.VEHICLE_INCOMPLETE });
  }
  const missing = ListingCheckKey.options.filter((key) => !state.checkedKeys.includes(key));
  if (missing.length > 0) {
    blockers.push({
      code: 'CHECKS_INCOMPLETE',
      message: BLOCKER_MESSAGES.CHECKS_INCOMPLETE(missing.length),
    });
  }
  if (state.imageCount < state.minImages) {
    blockers.push({
      code: 'TOO_FEW_IMAGES',
      message: BLOCKER_MESSAGES.TOO_FEW_IMAGES(state.imageCount, state.minImages),
    });
  }
  if (!state.hasPrimary) {
    blockers.push({ code: 'NO_PRIMARY_IMAGE', message: BLOCKER_MESSAGES.NO_PRIMARY_IMAGE });
  }

  return blockers;
}
