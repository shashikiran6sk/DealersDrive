import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export type PhoneSignInStage = 'number' | 'code' | 'failed';

export interface PhoneSignInProps {
  widget: PhoneOtpWidget | null;
  idPrefix: string;
  onProved: (phone: string, accessToken: string) => Promise<string | null>;
  verifyLabel?: string;
  initialStage?: PhoneSignInStage;
  initialPhone?: string;
}
