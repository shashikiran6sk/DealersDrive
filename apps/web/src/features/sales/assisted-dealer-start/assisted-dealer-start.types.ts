import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export interface VerifiedContact {
  phone: string;
  phoneTicket: string;
  email: string;
  emailTicket: string;
}

export interface AssistedDealerStartProps {
  widget: PhoneOtpWidget | null;
  initialVerified?: VerifiedContact;
}
