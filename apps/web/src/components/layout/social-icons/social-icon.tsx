import type { SocialLink } from '@dealers-drive/contracts';

import { SOCIAL_MARKS } from './social-marks';

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
