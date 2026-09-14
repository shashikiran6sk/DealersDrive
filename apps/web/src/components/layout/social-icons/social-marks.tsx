import type { SocialLink } from '@dealers-drive/contracts';
import type { ReactElement } from 'react';

/**
 * The six social marks, as inline SVG (**R44**). Inline rather than a library
 * because the alternative is a dependency for six paths, and no new dependency
 * is added that the baseline did not already have. They are drawn at
 * `currentColor` on a `0 0 24 24` box, so the footer's hover colour is the only
 * thing deciding how they look.
 */
export const SOCIAL_MARKS: Record<SocialLink['network'], ReactElement> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <path d="M14.5 8.5h2.2V5.6h-2.6c-2.3 0-3.7 1.4-3.7 3.7v1.9H8.1v2.9h2.3V21h3.1v-6.9h2.4l.4-2.9h-2.8V9.7c0-.8.3-1.2 1-1.2Z" />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.4 9.7 4.6 2.6-4.6 2.6V9.7Z" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.2 10.4V17M7.2 7.3v.1M11.2 17v-6.6M11.2 13.2c0-1.6.9-2.6 2.3-2.6 1.4 0 2.2.9 2.2 2.6V17" />
    </>
  ),
  x: (
    <path d="M4.2 3.8h4.1l4 5.5 4.6-5.5h2.6l-6 7.1 6.4 8.8h-4.1l-4.3-5.9-5 5.9H3.9l6.4-7.6L4.2 3.8Z" />
  ),
  whatsapp: (
    <>
      <path d="M20.2 12a8.2 8.2 0 0 1-12.1 7.2L3.8 20.4l1.3-4.2A8.2 8.2 0 1 1 20.2 12Z" />
      <path d="M9.2 8.6c.3-.1.6 0 .8.3l.7 1.2c.1.3.1.6-.1.8l-.5.5c.5 1 1.3 1.8 2.3 2.3l.5-.5c.2-.2.5-.3.8-.1l1.2.7c.3.2.4.5.3.8-.3.8-1.1 1.3-1.9 1.2a7.4 7.4 0 0 1-6-6c-.1-.8.3-1.6 1.1-1.9l.8-.3Z" />
    </>
  ),
};
