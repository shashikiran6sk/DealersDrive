export type EmailCodeStage = 'email' | 'code' | 'failed' | 'verified';

export interface VerifiedEmail {
  email: string;
  emailTicket: string;
}

export interface EmailCodeVerificationProps {
  onVerified: (result: VerifiedEmail) => void;
  initialEmail?: string;
  disabled?: boolean;
  initialStage?: EmailCodeStage;
}

export interface EmailCodePanelProps {
  codeId: string;
  email: string;
  code: string;
  onCodeChange: (next: string) => void;
  failed: boolean;
  message: string | null;
  notice: string | null;
  remaining: number;
  pending: boolean;
  disabled: boolean;
  onVerify: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
}
