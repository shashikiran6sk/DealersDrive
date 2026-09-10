import { createPublicKey, createVerify, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { UnauthorizedError, UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import type { PhoneVerifierPort, VerifiedPhone } from './phone.port.js';

/**
 * Firebase ID token verification, with `node:crypto` and no SDK.
 *
 * ── Why not `firebase-admin` ────────────────────────────────────────────────
 * Because the job is one RS256 signature check and six claim comparisons, and
 * `firebase-admin` is ~50 transitive packages including gRPC and protobuf to do
 * it. The definition of done for this repository forbids a dependency the
 * baseline did not already have, and — more to the point — a verifier nobody
 * can read is a verifier nobody audits. Everything Google's own documentation
 * requires is below, in order, with the reason for each check beside it.
 *
 * The token is a **Firebase ID token**, not a Google OAuth id_token: the two
 * have different issuers, different key endpoints and different claim shapes,
 * and `google.provider.ts` handles the other one. They are deliberately
 * separate files for that reason.
 *
 * ── What this proves, and what it does not ──────────────────────────────────
 * It proves that Google signed a statement that a person entered a code sent
 * to a particular handset, recently, for **this** Firebase project. It does not
 * authenticate anybody: the caller is already a signed-in dealer, established
 * by their Google session, and this is evidence about their phone number.
 */

/** Where Google publishes the public halves of its session-token signing keys. */
const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Google rotates these roughly daily and says how long each response is good for. */
const FALLBACK_CACHE_MS = 60 * 60 * 1000;

/** A little slack for clock skew between us and Google. Not a grace period. */
const CLOCK_SKEW_S = 60;

interface FirebaseClaims {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  auth_time: number;
  phone_number?: string;
  firebase?: { sign_in_provider?: string };
}

/**
 * `options` exists for the unit tests and for nothing else.
 *
 * They generate an RSA key pair, sign a token with it and prime it as the
 * "certificate" — real crypto, no network, no Firebase project and no SMS. The
 * project id has to come with it, because a token is checked against *this*
 * deployment's project and the suite does not have one configured.
 *
 * `createPublicKey` accepts an X.509 certificate PEM and an SPKI public-key PEM
 * alike, which is what lets a test prime the cheap one while production is
 * handed the real thing.
 */
export interface FirebaseVerifierOptions {
  projectId?: string;
  maxAgeSeconds?: number;
}

export function createFirebasePhoneVerifier(
  fetchImpl: typeof fetch = fetch,
  options: FirebaseVerifierOptions = {},
): PhoneVerifierPort & { primeCerts: (certs: Record<string, string>, ttlMs?: number) => void } {
  const projectId = options.projectId ?? env.FIREBASE_PROJECT_ID ?? '';
  const maxAgeSeconds = options.maxAgeSeconds ?? env.PHONE_VERIFICATION_MAX_AGE_S;
  let certs: Record<string, string> = {};
  let certsExpireAt = 0;
  let inFlight: Promise<void> | undefined;

  /**
   * Google's certificates, cached for as long as Google says.
   *
   * `inFlight` collapses a stampede: a burst of verifications past the cache
   * expiry must fetch once, not once per request. The failure mode without it
   * is not an outage — it is a quiet, self-inflicted rate limit against the one
   * endpoint every verification depends on.
   */
  async function loadCerts(force = false): Promise<void> {
    if (!force && Date.now() < certsExpireAt && Object.keys(certs).length > 0) return;
    inFlight ??= (async () => {
      try {
        const response = await fetchImpl(CERT_URL);
        if (!response.ok) {
          throw new UpstreamUnavailableError(
            'Phone verification is temporarily unavailable. Try again in a moment.',
            { code: 'PHONE_VERIFICATION_UNAVAILABLE' },
          );
        }
        certs = (await response.json()) as Record<string, string>;
        certsExpireAt = Date.now() + maxAgeOf(response.headers.get('cache-control'));
      } finally {
        inFlight = undefined;
      }
    })();
    await inFlight;
  }

  async function keyFor(kid: string): Promise<string> {
    await loadCerts();
    if (certs[kid]) return certs[kid];
    /*
     * An unknown `kid` is the normal shape of a key rotation, not an attack:
     * Google published a new key and our cache predates it. One forced refresh
     * answers that; a second unknown `kid` is a token we should not accept.
     */
    await loadCerts(true);
    const cert = certs[kid];
    if (!cert) {
      throw new UnauthorizedError('That verification could not be checked. Try again.', {
        code: 'PHONE_TOKEN_INVALID',
      });
    }
    return cert;
  }

  return {
    driver: 'firebase',

    async verify(idToken: string): Promise<VerifiedPhone> {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw invalid('malformed');

      const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
      const header = decode<{ alg?: string; kid?: string }>(headerPart);
      const claims = decode<FirebaseClaims>(payloadPart);

      /*
       * `alg` is checked before anything is done with the key, and only RS256
       * is accepted. The classic JWT vulnerability is a library that reads the
       * algorithm out of the token and obliges — `none` skips the signature
       * entirely, and `HS256` invites the public certificate to be used as an
       * HMAC secret it is not.
       */
      if (header.alg !== 'RS256' || !header.kid) throw invalid('header');

      const cert = await keyFor(header.kid);
      const signed = `${headerPart}.${payloadPart}`;
      const signature = Buffer.from(signaturePart, 'base64url');

      const verifier = createVerify('RSA-SHA256');
      verifier.update(signed);
      verifier.end();
      if (!verifier.verify(createPublicKey(cert), signature)) throw invalid('signature');

      const now = Math.floor(Date.now() / 1000);

      // `aud` is the project. Without this check a token minted by *any*
      // Firebase project — one the attacker owns — verifies against the same
      // Google certificates and would be accepted here.
      if (!equals(claims.aud, projectId)) throw invalid('aud');
      if (!equals(claims.iss, `https://securetoken.google.com/${projectId}`)) throw invalid('iss');

      if (typeof claims.sub !== 'string' || claims.sub.length === 0) throw invalid('sub');
      if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) throw expired();
      if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_S > now) throw invalid('iat');

      /*
       * The number is taken from the token and from nowhere else, and the
       * provider must be `phone`. A Firebase project can hold accounts signed
       * in by email, Google or anonymously, and every one of those mints an ID
       * token against the same project with the same `aud` — none of them
       * proves a handset, and an anonymous one proves nothing at all.
       */
      if (claims.firebase?.sign_in_provider !== 'phone') throw invalid('provider');
      const phone = claims.phone_number;
      if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone)) throw invalid('phone');

      /*
       * Freshness, from `auth_time` rather than `iat`.
       *
       * A Firebase ID token is refreshable for a year off one sign-in, so `iat`
       * only says when the browser last asked for a new copy. `auth_time` is
       * when a person actually entered the code — which is the fact this
       * endpoint is buying, and the only one worth putting a window around. It
       * is what stops a token captured months ago from re-verifying a number
       * today.
       */
      if (
        typeof claims.auth_time !== 'number' ||
        claims.auth_time + maxAgeSeconds + CLOCK_SKEW_S < now
      ) {
        throw expired();
      }

      logger.info(
        { provider: 'firebase', sub: claims.sub, phone },
        'phone verification token accepted',
      );

      return {
        phone,
        providerUserId: claims.sub,
        authenticatedAt: new Date(claims.auth_time * 1000),
      };
    },

    /** The unit tests' seam: a locally generated key, so no network and no SMS. */
    primeCerts(next: Record<string, string>, ttlMs = FALLBACK_CACHE_MS): void {
      certs = next;
      certsExpireAt = Date.now() + ttlMs;
    },
  };
}

/**
 * One code for every structural failure, and the reason is not laziness.
 *
 * A caller cannot act differently on "the signature was wrong" than on "the
 * audience was wrong" — both mean *this token is not proof* — and an error that
 * says which check failed tells someone probing the endpoint exactly how far
 * their forgery got. The `reason` is logged; it is not returned.
 */
function invalid(reason: string): UnauthorizedError {
  logger.warn({ provider: 'firebase', reason }, 'phone verification token rejected');
  return new UnauthorizedError('That verification could not be checked. Try again.', {
    code: 'PHONE_TOKEN_INVALID',
  });
}

/**
 * Expiry is the exception, and it is separated for the dealer's sake rather
 * than the attacker's: "your code has expired, send another" is actionable and
 * common, and telling somebody their code was *invalid* when it had merely
 * gone stale sends them looking for a typo that is not there.
 */
function expired(): UnauthorizedError {
  logger.info({ provider: 'firebase' }, 'phone verification token expired');
  return new UnauthorizedError('That code has expired. Send a new one and try again.', {
    code: 'PHONE_TOKEN_EXPIRED',
  });
}

function decode<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw invalid('decode');
  }
}

/** Constant-time, because both operands are attacker-influenced strings. */
function equals(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string') return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** `public, max-age=19052, must-revalidate, no-transform` → 19052000. */
function maxAgeOf(header: string | null): number {
  const match = /max-age=(\d+)/.exec(header ?? '');
  if (!match?.[1]) return FALLBACK_CACHE_MS;
  return Number(match[1]) * 1000;
}
