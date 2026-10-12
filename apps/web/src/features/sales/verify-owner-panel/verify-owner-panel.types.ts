import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export interface VerifyOwnerPanelProps {
  dealerId: string;
  phone: string;
  phoneDisplay: string;
  widget: PhoneOtpWidget | null;
}
