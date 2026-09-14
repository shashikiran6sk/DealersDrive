import type { PublicConfig } from '@dealers-drive/contracts';

export interface FooterLink {
  href: string;
  label: string;
}

/**
 * Only what the footer renders, rather than the whole `PublicConfig`. The
 * payload carries eleven fields and this component reads three; taking the whole
 * thing would make every sandbox scenario construct eight values with no effect
 * on the output.
 *
 * An empty string is "we do not have one" for both contacts — what
 * `NO_PUBLIC_CONFIG` degrades to when the API is unreachable — and the row is
 * then absent rather than rendered blank.
 */
export interface CustomerFooterProps {
  social: PublicConfig['social'];
  supportEmail: string;
  supportPhone: string;
}
