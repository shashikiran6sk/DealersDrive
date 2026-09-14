/**
 * The seam between the product and whoever actually sent the SMS (**R39**).
 *
 * There is exactly one question behind this port, and it is deliberately not
 * "was this code correct": **which identifier does this token prove?** The code
 * never reaches the API. MSG91's OTP widget runs in the dealer's browser,
 * sends the message, collects the six digits and answers with a signed access
 * token; the only thing the server can do with that token is take it to MSG91
 * and ask whose handset it belongs to.
 *
 * Shaping the port that way is what keeps the trust boundary in one place. A
 * `verify(code)` signature would invite an adapter that believes the browser,
 * and the browser is the one participant here with a reason to lie.
 *
 * Two adapters today, chosen by `PHONE_OTP_DRIVER`:
 *
 *   fake   — no network, no SMS, no widget script. Accepts a token of the
 *            documented development shape and answers with the identifier
 *            inside it. Correct for `pnpm dev` and for the test suite;
 *            `env.ts` refuses it in production.
 *   msg91  — the real provider. `POST /api/v5/widget/verifyAccessToken`
 *            with the server-only `MSG91_AUTH_KEY`.
 */

/** An identifier as MSG91 states it: digits, country code included, no `+`. */
export type MsisdnDigits = string;

/**
 * Three outcomes, not two, and the third is why.
 *
 * `REJECTED` means MSG91 answered and said no — an expired token, a replayed
 * one, a forgery. `UNAVAILABLE` means MSG91 did not answer at all. Collapsing
 * them would tell a dealer their code was wrong during a vendor outage, and
 * send them round the resend loop spending SMS against a provider that is down.
 */
export type PhoneOtpVerdict =
  | { status: 'VERIFIED'; identifier: MsisdnDigits }
  | { status: 'REJECTED'; reason: string }
  | { status: 'UNAVAILABLE' };

export interface PhoneOtpPort {
  /** Names the active adapter. Reported to the browser, never branched on here. */
  readonly driver: 'fake' | 'msg91';

  /**
   * Ask the provider which identifier this access token proves.
   *
   * Never throws for a refusal — a refusal is a verdict. It throws only for a
   * bug, which is the error handler's business rather than this caller's.
   */
  identify(accessToken: string): Promise<PhoneOtpVerdict>;
}
