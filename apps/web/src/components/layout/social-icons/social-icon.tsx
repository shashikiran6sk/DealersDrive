import type { SocialLink } from '@dealers-drive/contracts';

import { SOCIAL_MARKS } from './social-marks';

/**
 * One mark, 16×16, inheriting the anchor's colour.
 *
 * `strokeWidth` is 1.6 rather than 1 because these sit at 16px beside 12–13px
 * text, and a hairline stroke at that size disappears against the footer's
 * ground on a non-retina display.
 *
 * `aria-hidden` because the accessible name lives on the anchor that wraps it.
 */
export function SocialIcon({ network }: { network: SocialLink['network'] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SOCIAL_MARKS[network]}
    </svg>
  );
}
