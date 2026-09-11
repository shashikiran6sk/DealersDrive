/** Managed SMS verification only; Google OAuth remains the identity provider. */
export interface PhoneVerifierPort {
  readonly driver: 'msg91' | 'fake';
  /** Generate and deliver a six-digit code. Never return the code. */
  send(phone: string): Promise<void>;
  /** Verify against the server-owned challenge's E.164 phone. */
  verify(phone: string, code: string): Promise<void>;
}
