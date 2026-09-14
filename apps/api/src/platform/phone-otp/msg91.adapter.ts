import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import type { MsisdnDigits, PhoneOtpPort, PhoneOtpVerdict } from './phone-otp.port.js';

/**
 * MSG91's OTP widget, verified server-side (**R39**).
 *
 * One authenticated `POST`, no SDK — the same reasoning as the Resend mailer
 * and as the baseline's MSG91 SMS adapter: a dependency to make a single JSON
 * request is a dependency to audit, update and explain.
 *
 *     POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 *     { "authkey": "…", "access-token": "<jwt from the widget>" }
 *
 * **`authkey` never leaves this process.** It is the credential that can spend
 * the MSG91 balance, and the whole reason this call is server-to-server rather
 * than something the page could do for itself.
 *
 * ── Where the identifier comes from ─────────────────────────────────────────
 * The widget's server-side documentation publishes the request but not the
 * response body, and the shape reported in the wild varies: some accounts get
 * `{ type: 'success', message: '919840012345' }`, others a bare acknowledgement.
 * The product cannot act on "a token was valid" alone — it has to know *whose*
 * handset, or the binding check in `phone.service.ts` has nothing to compare —
 * so the identifier is looked for in two places, in this order:
 *
 *   1. the response body, when it carries something that reads as an
 *      identifier;
 *   2. the access token's own payload.
 *
 * Reading the JWT is safe **only in that order**, and the order is the whole
 * argument: the token's signature has already been checked, by MSG91, in the
 * call above. A forged token never reaches step 2 because step 1 rejected it,
 * and a genuine token's payload cannot be edited without invalidating the
 * signature that got it past step 1. This decodes a claim; it does not trust an
 * unverified one.
 *
 * If neither yields an identifier the call is `REJECTED`, not accepted. Failing
 * open here would mean accepting any token that verifies for any number.
 */
const ENDPOINT = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

/** Claim names seen carrying the verified identifier, most specific first. */
const IDENTIFIER_CLAIMS = ['identifier', 'mobile', 'number', 'phone', 'msisdn'] as const;

export function createMsg91PhoneOtp(fetchImpl: typeof fetch = fetch): PhoneOtpPort {
  return {
    driver: 'msg91',

    async identify(accessToken: string): Promise<PhoneOtpVerdict> {
      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            authkey: env.MSG91_AUTH_KEY ?? '',
            'access-token': accessToken,
          }),
          /*
           * Bounded, because a dealer is watching a spinner. Four seconds is
           * the same budget the RC lookup takes for the same reason: the
           * fallback — try again — is one press away, so failing fast beats
           * succeeding slowly.
           */
          signal: AbortSignal.timeout(env.PHONE_OTP_TIMEOUT_MS),
        });
      } catch (error) {
        // DNS, TLS, a dropped socket, the timeout above. Not the dealer's
        // fault and not a wrong code — see `PhoneOtpVerdict`.
        logger.warn({ err: error, driver: 'msg91' }, 'msg91 access-token verification unreachable');
        return { status: 'UNAVAILABLE' };
      }

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok || !isSuccess(body)) {
        /*
         * The provider's own words are logged and not returned. A caller is
         * told "that code could not be verified" and nothing more: this
         * response distinguishes an expired token from an unknown widget from
         * a wrong account, and none of those are facts a browser should be
         * handed about somebody else's number.
         */
        logger.info(
          { driver: 'msg91', status: response.status, providerMessage: messageOf(body) },
          'msg91 refused an access token',
        );
        return { status: 'REJECTED', reason: 'the provider refused the token' };
      }

      const identifier = identifierFromBody(body) ?? identifierFromToken(accessToken);
      if (!identifier) {
        // Verified, but for nobody we can name. Accepting this would be
        // accepting any valid token for any number.
        logger.error(
          { driver: 'msg91', status: response.status },
          'msg91 verified an access token that names no identifier',
        );
        return { status: 'REJECTED', reason: 'the provider named no identifier' };
      }

      return { status: 'VERIFIED', identifier };
    },
  };
}

/** MSG91's envelope: `{ type: 'success' | 'error', message: … }`. */
function isSuccess(body: unknown): boolean {
  return isRecord(body) && text(body.type).toLowerCase() === 'success';
}

function messageOf(body: unknown): string {
  return isRecord(body) ? text(body.message).slice(0, 200) : '';
}

/**
 * A field of the provider's answer as a string, or nothing.
 *
 * Written out rather than `String(value)` because `message` is documented
 * nowhere and has been seen carrying an object — and `String({})` is
 * `'[object Object]'`, which would be logged as though it were the provider's
 * own sentence.
 */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * The identifier in the response, when there is one.
 *
 * `message` carries it on the accounts that return it, and carries a sentence
 * on the ones that do not — so it is accepted only when it *reads* as an
 * identifier. `'Access token validated'` has no digits in it and falls through
 * to the token payload rather than being mistaken for a number.
 */
function identifierFromBody(body: unknown): MsisdnDigits | null {
  if (!isRecord(body)) return null;

  for (const key of [...IDENTIFIER_CLAIMS, 'message']) {
    const found = asIdentifier(body[key]);
    if (found) return found;
  }
  return null;
}

/**
 * The identifier inside the token MSG91 has just told us is genuine.
 *
 * Decoded, not verified — see the note at the top of this file for why that is
 * sound here and would not be anywhere else.
 */
function identifierFromToken(accessToken: string): MsisdnDigits | null {
  const segments = accessToken.split('.');
  if (segments.length !== 3 || !segments[1]) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  for (const claim of IDENTIFIER_CLAIMS) {
    const found = asIdentifier(payload[claim]);
    if (found) return found;
  }
  return null;
}

/**
 * A value that is an msisdn, or nothing.
 *
 * Deliberately strict about what counts. An email identifier, a request id or
 * a sentence must not be mistaken for a phone number here — the caller
 * compares whatever comes back against the number the dealer claimed, and a
 * value that is not a number would simply fail that comparison, but it would
 * fail it for a confusing reason.
 */
function asIdentifier(value: unknown): MsisdnDigits | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(/^\+/, '');
  return /^\d{8,15}$/.test(text) ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
