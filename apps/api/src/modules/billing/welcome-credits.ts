import type { PlatformConfigService } from '../../platform/config/platform-config.js';
import type { Tx } from '../../platform/db/prisma.js';
import { moveCredits, type CreditActor } from './credits.js';

export async function grantWelcomeCredits(
  tx: Tx,
  config: PlatformConfigService,
  dealerId: string,
  actor: CreditActor,
): Promise<number> {
  const credits = Math.max(0, Math.trunc(await config.number('billing.welcomeCredits')));
  if (credits === 0) return 0;
  const already = await tx.creditTransaction.count({
    where: { dealerId, reason: 'WELCOME_GRANT' },
  });
  if (already > 0) return 0;
  await moveCredits(tx, { dealerId, reason: 'WELCOME_GRANT', delta: credits, actor });
  return credits;
}
