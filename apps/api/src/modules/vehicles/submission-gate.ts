import type { Listing } from '@prisma/client';

import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { holdForSubmission, listingCreditsEnabled } from '../billing/billing.facade.js';
import { assertPhotosReady, dealerPhotosEnabled } from '../dealer-photos/dealer-photos.facade.js';

export interface SubmissionActor {
  type: 'DEALER' | 'SALES';
  id: string;
}

export interface SubmissionGate {
  prepare(tx: Tx, listing: Listing, actor: SubmissionActor): Promise<void>;
}

export const OPEN_GATE: SubmissionGate = { prepare: () => Promise.resolve() };

export function createSubmissionGate(config: PlatformConfigService): SubmissionGate {
  return {
    async prepare(tx, listing, actor) {
      const [photos, credits] = await Promise.all([
        dealerPhotosEnabled(config),
        listingCreditsEnabled(config),
      ]);
      if (photos && actor.type === 'DEALER') await assertPhotosReady(tx, listing);
      if (credits) await holdForSubmission(tx, config, listing, listing.photoPlan, actor);
    },
  };
}
