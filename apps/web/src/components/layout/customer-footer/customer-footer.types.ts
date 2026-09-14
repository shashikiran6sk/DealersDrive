import type { PublicConfig } from '@dealers-drive/contracts';

export interface FooterLink {
  href: string;
  label: string;
}

export interface CustomerFooterProps {
  social: PublicConfig['social'];
  supportEmail: string;
  supportPhone: string;
}
