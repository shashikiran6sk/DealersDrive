import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export type PhoneStage = 'idle' | 'code' | 'failed';

export interface PhoneVerificationProps {
  widget: PhoneOtpWidget | null;
  phone: string;
  fullName: string;
  verified: boolean;
  onVerified: (phone: string) => void;
  onContinue: () => void;
  onBeforeSend: (form: HTMLFormElement | null) => boolean;
  onRefused?: (message: string) => void;
  initialStage?: PhoneStage;
}
