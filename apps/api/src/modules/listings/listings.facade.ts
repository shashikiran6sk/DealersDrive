/**
 * `listings` as other modules see it (ARCHITECTURE §5.5 rule 3).
 *
 * The state machine, and only the state machine. `transition` is the single
 * gate every status change passes through (CLAUDE.md rule 5), and `displayStatus`
 * is the one derived status the API returns, computed here so that no two
 * modules can disagree about whether a dealer's car is live.
 */
export { canTransition, displayStatus, transition } from './listing.state.js';
export type { Actor, ListingEvent } from './listing.state.js';
