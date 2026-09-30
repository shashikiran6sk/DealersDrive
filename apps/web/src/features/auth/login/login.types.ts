import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export type LoginAudience = 'customer' | 'dealer';

export interface GoogleEntry {
  href: string;
  enabled: boolean;
  reason: string | null;
}

export interface CustomerLoginProps {
  widget: PhoneOtpWidget | null;
  returnTo: string;
  whatsappOtp?: boolean;
}

export interface DealerLoginProps {
  widget: PhoneOtpWidget | null;
  google: GoogleEntry;
  returnTo: string | null;
  error: string | null;
  whatsappOtp?: boolean;
}
