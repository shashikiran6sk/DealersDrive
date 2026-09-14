export type MsisdnDigits = string;

export type PhoneOtpVerdict =
  | { status: 'VERIFIED'; identifier: MsisdnDigits }
  | { status: 'REJECTED'; reason: string }
  | { status: 'UNAVAILABLE' };

export interface PhoneOtpPort {
  readonly driver: 'fake' | 'msg91';

  identify(accessToken: string): Promise<PhoneOtpVerdict>;
}
