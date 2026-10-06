import type { PhoneOtpWidget } from '@dealers-drive/contracts';

import type { PhoneVerificationState } from '@/features/auth/phone-actions';

export type PhoneStage = 'idle' | 'code' | 'failed';

export interface PhoneVerificationProps {
  widget: PhoneOtpWidget | null;
  phone: string;
  fullName: string;
  verified: boolean;
  onVerified: (phone: string, result: PhoneVerificationState) => void;
  onContinue: () => void;
  onBeforeSend: (form: HTMLFormElement | null) => boolean;
  onRefused?: (message: string) => void;
  initialStage?: PhoneStage;
  verifyAction?: (phone: string, accessToken: string) => Promise<PhoneVerificationState>;
  checkAvailability?: ((phone: string) => Promise<{ error?: string }>) | null;
  verifiedTitle?: string;
  continueLabel?: string;
}
