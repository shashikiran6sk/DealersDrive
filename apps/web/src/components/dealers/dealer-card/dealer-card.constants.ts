/**
 * A hard height, not a floor, and **measured rather than derived** (**R21**,
 * re-derived for **R28**). The `Fullest` sandbox story is what guards it: a
 * two-line registered name, a two-line tagline and three services wrapping to a
 * second row, all at once — an ordinary Indian dealership with a complete
 * profile. Nothing on that story may be cut off; clipping here is silent and
 * what it eats first is half a row of chips.
 *
 * Arithmetic disagrees, and that is worth recording because the next person to
 * change the type scale will reach for it first: adding the deltas to R21's
 * measured 368 gives 424, because it treats each part as if it were laid out
 * alone and the parts it adds up are the parts already carrying slack. The
 * fullest card is the one where the slack goes to zero, and only a rendered card
 * answers where that is. Re-measure against `Fullest` after any change to the
 * type scale, the tag padding or the cover.
 */
export const CARD_HEIGHT = 'h-[400px]';

/** The cover band, and the distance the logo tile is pulled up over it. */
export const COVER_HEIGHT = 'h-[128px]';
export const TILE_SIZE = 48;

/** At most three, so one verbose dealership cannot spend the whole prose box. */
export const SERVICES_SHOWN = 3;

import { countLabel } from '@/lib/plural';

export const DEALER_CARD_TEXT = {
  yardVerified: 'YARD VERIFIED',
  verifiedDealer: 'VERIFIED DEALER',
  viewInventory: 'View inventory',
  arrow: '→',
  openQuote: '“',
  closeQuote: '”',
  coverAlt: (brandName: string) => `${brandName} — yard photo`,
  carsListed: (carCount: number) => `${countLabel(carCount, 'car')} listed`,
} as const;
