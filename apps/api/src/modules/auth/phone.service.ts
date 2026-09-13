import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import {
  formatPhone,
  toE164,
  type PhoneAvailabilityInput,
  type PhoneOtpWidget,
  type VerifyPhoneInput,
  type VerifyPhoneResponse,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { CachePort } from '../../platform/cache/cache.port.js';
import { ConflictError, DomainError, UpstreamUnavailableError } from '../../platform/errors.js';
import type { PhoneOtpPort } from '../../platform/phone-otp/phone-otp.port.js';
import { logger } from '../../platform/telemetry/logger.js';

/**
 * B8 — proving the mobile number (**R39**).
 *
 * ── Where the work happens, and what that costs ─────────────────────────────
 * MSG91's OTP widget does the sending and the collecting **in the dealer's
 * browser**. The API never sees the six digits, never calls a send endpoint,
 * and therefore cannot rate-limit the sending. That is a real consequence of
 * the widget design and it is worth stating plainly rather than papering over:
 * the two controls this module *does* hold are
 *
 *   1. **who gets the widget credentials at all** — `widget()` is behind
 *      `requireSignedIn`, so an SMS can only be provoked by somebody who has
 *      already completed a Google sign-in, not by the open internet; and
 *   2. **how often a token may be presented** — the route is rate-limited per
 *      session, and a token that has been accepted once is never accepted
 *      again.
 *
 * The provider's own per-identifier limits are the third, and they are the only
 * thing standing between a signed-in account and repeated sends. If that proves
 * too loose in practice the answer is an API-side send endpoint, which is a
 * different integration, not a tightening of this one.
 *
 * ── What a verification is, and is not ──────────────────────────────────────
 * It issues no session, grants no permission and unlocks no screen. Identity is
 * the Google account and was before the code was sent. What it buys is that the
 * number printed on a public portfolio rings the dealership that published it —
 * so the write it performs is a contact detail, not a credential.
 */
export interface PhoneServiceDeps {
  prisma: PrismaClient;
  otp: PhoneOtpPort;
  cache: CachePort;
}

/**
 * How long an accepted token is remembered as spent.
 *
 * Longer than any access token MSG91 issues, which is what makes the guard
 * total rather than probabilistic: a token that outlives its entry here would
 * be one that could be replayed. Fifteen minutes is comfortably past the
 * widget's own expiry and costs one short-lived counter row per verification.
 */
const TOKEN_SPENT_WINDOW_SECONDS = 15 * 60;

export function createPhoneService({ prisma, otp, cache }: PhoneServiceDeps) {
  return {
    /**
     * What the browser needs to initialise the widget — and nothing else.
     *
     * `MSG91_AUTH_KEY` is conspicuously absent. It is the credential that can
     * spend the account's balance and the reason `verify` below is a
     * server-to-server call; it must never appear in a response.
     */
    widget(): PhoneOtpWidget {
      if (otp.driver === 'fake') {
        return {
          enabled: true,
          driver: 'fake',
          widgetId: null,
          tokenAuth: null,
          devCode: env.PHONE_OTP_DEV_CODE,
          reason: null,
        };
      }

      const widgetId = env.MSG91_WIDGET_ID;
      const tokenAuth = env.MSG91_WIDGET_TOKEN;

      /*
       * Unreachable as configured — `env.ts` refuses to boot on `msg91`
       * without both — and answered rather than thrown anyway. A sign-up
       * screen that renders an explanation is better than one that renders a
       * 500, and this is the same shape `GET /v1/auth/providers` takes for a
       * deployment with no Google client.
       */
      if (!widgetId || !tokenAuth) {
        return {
          enabled: false,
          driver: 'msg91',
          widgetId: null,
          tokenAuth: null,
          devCode: null,
          reason: 'Set MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN to verify mobile numbers.',
        };
      }

      return { enabled: true, driver: 'msg91', widgetId, tokenAuth, devCode: null, reason: null };
    },

    /**
     * B8b — is this number free for this account to claim?
     *
     * Called before the widget sends anything, which is the only reason it
     * exists as its own endpoint: the send happens in the browser, so the API
     * cannot refuse one in flight. The alternative — letting the refusal arrive
     * with the verification — spends an SMS to tell a dealer their number
     * belongs to somebody else, and delivers it to a handset whose owner did
     * not ask for it.
     *
     * The read is not the guarantee and is not pretending to be one. Two people
     * can pass this check for the same number at the same instant; the unique
     * index on `users.phone` decides, and `verify` below answers the loser with
     * the same refusal. This is the cheap, early copy of a question that is
     * asked again where it can actually be enforced.
     *
     * Deliberately says nothing about who holds a taken number — see
     * `PhoneAvailabilityInput` for why that matters.
     */
    async assertAvailable(userId: string, input: PhoneAvailabilityInput): Promise<void> {
      const phone = toE164(input.phone);
      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId) throw alreadyRegistered();
    },

    /**
     * Take the widget's access token to MSG91, and record what comes back.
     *
     * Four things have to hold, in this order, and each of them refuses
     * differently:
     *
     *   1. MSG91 recognises the token — otherwise there is no verification.
     *   2. The identifier it names is **the number this request claims**.
     *      Without this a dealer could verify a handset they hold and then
     *      register a number they do not.
     *   3. The token has not been presented before.
     *   4. The number is not already somebody else's.
     */
    async verify(
      userId: string,
      input: VerifyPhoneInput,
      context: { ip?: string } = {},
    ): Promise<VerifyPhoneResponse> {
      const phone = toE164(input.phone);
      // MSG91 states identifiers as digits with the country code and no `+`.
      const claimed = phone.replace(/\D/g, '');

      const verdict = await otp.identify(input.accessToken);

      if (verdict.status === 'UNAVAILABLE') {
        throw new UpstreamUnavailableError(
          'We could not reach the verification service. Try again in a moment.',
          { code: 'PHONE_OTP_UNAVAILABLE' },
        );
      }

      if (verdict.status === 'REJECTED' || verdict.identifier !== claimed) {
        /*
         * One message for both, deliberately. "That code was for a different
         * number" would confirm to whoever is holding a stolen token which
         * number it belongs to, and there is no legitimate flow in which the
         * page sends a token for a number the dealer did not just type.
         */
        logger.info(
          {
            event: 'phone.verify.refused',
            userId,
            driver: otp.driver,
            ip: context.ip,
            reason: verdict.status === 'REJECTED' ? verdict.reason : 'identifier mismatch',
          },
          'phone verification refused',
        );
        throw new DomainError(
          'PHONE_VERIFICATION_FAILED',
          'That code could not be verified. Request a new one and try again.',
          {
            errors: [
              {
                field: 'body.accessToken',
                code: 'PHONE_VERIFICATION_FAILED',
                message: 'Not verified.',
              },
            ],
          },
        );
      }

      await consumeToken(cache, input.accessToken);

      /*
       * The read is the message; the unique index on `users.phone` is the
       * guarantee. Two people verifying one number at the same instant race
       * past this check and the second one's write fails — which is the right
       * way round, because the index is the thing that cannot be wrong.
       */
      const holder = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (holder && holder.id !== userId) throw alreadyRegistered();

      const verifiedAt = new Date();
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { phone, phoneVerifiedAt: verifiedAt },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') throw alreadyRegistered();
        throw error;
      }

      logger.info(
        { event: 'phone.verify.succeeded', userId, driver: otp.driver },
        'phone number verified',
      );

      return {
        phone,
        phoneDisplay: formatPhone(phone),
        verifiedAt: verifiedAt.toISOString(),
      };
    },
  };
}

export type PhoneService = ReturnType<typeof createPhoneService>;

/**
 * One token, one verification.
 *
 * Checked *after* the provider has accepted the token rather than before, so a
 * vendor timeout does not burn the dealer's only attempt: a token that never
 * verified was never spent, and pressing the button again has to work.
 *
 * A cache failure does not deny the request, for the same reason
 * `createRateLimiter` does not: this is a replay guard, not a spend control,
 * and turning a database blip into "nobody can finish signing up" converts a
 * degraded dependency into an outage. The token is hashed because it is a
 * bearer credential and cache keys are not a place to keep one.
 */
async function consumeToken(cache: CachePort, accessToken: string): Promise<void> {
  const key = `phone-otp:spent:${createHash('sha256').update(accessToken).digest('hex')}`;

  let seen: number;
  try {
    seen = (await cache.increment(key, TOKEN_SPENT_WINDOW_SECONDS)).count;
  } catch (error) {
    logger.warn({ err: error }, 'phone otp replay guard unavailable — allowing the verification');
    return;
  }

  if (seen > 1) {
    throw new DomainError(
      'PHONE_VERIFICATION_FAILED',
      'That code has already been used. Request a new one and try again.',
      {
        errors: [
          {
            field: 'body.accessToken',
            code: 'PHONE_VERIFICATION_FAILED',
            message: 'Already used.',
          },
        ],
      },
    );
  }
}

function alreadyRegistered(): ConflictError {
  return new ConflictError(
    'PHONE_ALREADY_REGISTERED',
    'That mobile number is already registered to another dealership.',
    {
      errors: [
        { field: 'body.phone', code: 'PHONE_ALREADY_REGISTERED', message: 'Already registered.' },
      ],
    },
  );
}
