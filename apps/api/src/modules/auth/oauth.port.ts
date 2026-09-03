/**
 * The seam between "who is this person" and Google.
 *
 * Everything above this interface deals in a verified subject, an email and a
 * flag saying Google checked it. Nothing above it knows about authorization
 * codes, PKCE verifiers, JWTs or `accounts.google.com` — which is what lets the
 * whole sign-in flow be tested without a network, by passing a fake in at the
 * container (ARCHITECTURE §5.1, §5.3).
 */

/** What the provider asserts once the round trip has been verified. */
export interface OAuthClaims {
  /** The provider's stable identifier for the account — Google's `sub`. */
  subject: string;
  email: string;
  /** Google's `email_verified`. A false here is a refused sign-in, not a warning. */
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface AuthorizationRequest {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Forces the account chooser rather than silently reusing one Google session. */
  prompt?: 'select_account' | 'consent';
}

export interface OAuthProvider {
  /** Matches `OAuthIdentity.provider`. */
  readonly id: 'GOOGLE';

  /**
   * Whether this deployment holds the credentials to perform a sign-in.
   *
   * Asked rather than assumed so the sign-in screen can render an explanation
   * instead of a button that fails on click — and so the route never has to
   * know which environment variables a particular provider needs.
   */
  isConfigured(): boolean;

  /** Where to send the browser. Never called with anything a client supplied. */
  authorizationUrl(request: AuthorizationRequest): string;

  /**
   * Redeems the authorization code and returns the verified claims.
   *
   * Throws rather than returning null: a failure here is either a
   * misconfiguration or an attack, never an ordinary outcome the caller should
   * branch on.
   */
  exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<OAuthClaims>;
}
