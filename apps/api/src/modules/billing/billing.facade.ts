/**
 * `billing` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * This is the credit ledger, and it is the most important facade in the system:
 * `moveCredits` is the *only* way a balance changes (CLAUDE.md rule 4). Exposing
 * it here — and nothing else that writes — is what makes "every movement writes a
 * transaction" checkable by reading one file.
 */
export {
  currentBalance,
  InsufficientCreditsError,
  moveCredits,
  refreshActiveListings,
  refreshHeldCount,
} from './credits.service.js';
export type { CreditMovement, CreditMovementResult } from './credits.service.js';
