import { submissionCost, type CreditCosts, type PhotoPlan } from '@dealers-drive/contracts';
import type { Listing } from '@prisma/client';

import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { LEDGER_NOTES } from './billing.messages.js';
import { moveCredits, type CreditActor } from './credits.js';

export async function creditCosts(config: PlatformConfigService): Promise<CreditCosts> {
  const [listing, photoshoot] = await Promise.all([
    config.number('billing.listingCredits'),
    config.number('billing.photoshootCredits'),
  ]);
  return { listing: Math.max(0, listing), photoshoot: Math.max(0, photoshoot) };
}

export async function listingCreditsEnabled(config: PlatformConfigService): Promise<boolean> {
  return config.flag('feature.listingCredits');
}

export async function holdForSubmission(
  tx: Tx,
  config: PlatformConfigService,
  listing: Listing,
  plan: PhotoPlan | null,
  actor: CreditActor,
): Promise<void> {
  const required = submissionCost(plan, await creditCosts(config));
  const change = required - listing.creditsHeld;
  if (change === 0) return;
  await moveCredits(tx, {
    dealerId: listing.dealerId,
    reason: listing.creditsHeld === 0 ? 'HOLD_SUBMIT' : 'HOLD_ADJUST',
    heldDelta: change,
    listingId: listing.id,
    actor,
    note: listing.creditsHeld === 0 ? LEDGER_NOTES.hold : LEDGER_NOTES.holdAdjusted,
  });
  await tx.listing.update({ where: { id: listing.id }, data: { creditsHeld: required } });
}

export async function settleListingCredits(
  tx: Tx,
  listing: Listing,
  outcome: 'consume' | 'release',
  actor: CreditActor,
): Promise<void> {
  const held = listing.creditsHeld;
  if (held <= 0) return;
  await moveCredits(tx, {
    dealerId: listing.dealerId,
    reason: outcome === 'consume' ? 'CONSUME_APPROVE' : 'RELEASE_REJECT',
    delta: outcome === 'consume' ? -held : 0,
    heldDelta: -held,
    listingId: listing.id,
    actor,
    note: outcome === 'consume' ? LEDGER_NOTES.consume : LEDGER_NOTES.release,
  });
  await tx.listing.update({
    where: { id: listing.id },
    data: {
      creditsHeld: 0,
      ...(outcome === 'consume' ? { creditsSpent: { increment: held } } : {}),
    },
  });
}
