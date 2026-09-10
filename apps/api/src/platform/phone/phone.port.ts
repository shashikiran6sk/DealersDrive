/**
 * Phone verification behind one narrow port (**R39**).
 *
 * The product's position on identity has not changed: **Google is the door.**
 * A dealer signs in with a Google account and always will, and nothing here
 * issues a session or authenticates anybody. What this proves is a different
 * fact about an already-authenticated dealer — that the mobile number their
 * public page will carry is a handset they hold.
 *
 * That distinction is why the port returns a phone number and not a principal.
 * A `VerifiedPhone` is evidence, not a credential; the caller decides what to
 * do with it, and the only caller is `auth.service.verifyPhone`.
 *
 * Two adapters implement it. `firebase.adapter.ts` verifies a real Firebase ID
 * token against Google's signing certificates; `fake.adapter.ts` accepts a
 * structured string so that local development and the whole test suite work
 * without an SMS, a Firebase project or a network. The seam is
 * `PHONE_VERIFICATION_DRIVER`, chosen in the container and never by a module.
 */
export interface VerifiedPhone {
  /** E.164, exactly as the provider signed it: `+919840012345`. */
  phone: string;
  /**
   * The provider's own id for the handset — Firebase's `sub`.
   *
   * Not stored. It is here because it is the right thing to *log*: a support
   * question about a verification that did not stick is answerable from it,
   * and it is the one identifier that is stable across a number being retyped.
   */
  providerUserId: string;
  /**
   * When the OTP was actually entered, from the token's `auth_time`.
   *
   * Distinct from "when the token was issued": a Firebase ID token can be
   * refreshed for a year off one sign-in, so `iat` says nothing about how long
   * ago a person held the handset. Freshness is checked against this.
   */
  authenticatedAt: Date;
}

export interface PhoneVerifierPort {
  /** The driver name, for the health payload and the startup log line. */
  readonly driver: 'firebase' | 'fake';
  /**
   * Throws `UnauthorizedError` when the token is not a valid, current proof.
   * Never returns a partially-checked result — a caller cannot forget to look.
   */
  verify(idToken: string): Promise<VerifiedPhone>;
}
