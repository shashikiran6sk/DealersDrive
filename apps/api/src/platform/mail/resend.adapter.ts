import { env } from '../../config/env.js';
import { UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import type { MailerPort, MailMessage, MailResult } from './mail.port.js';

/**
 * Resend, over its HTTP API and with no SDK (**R40**).
 *
 * Same reasoning as `platform/notify/msg91.adapter.ts` in the baseline and as
 * the Firebase verifier: the job is one authenticated `POST` with a JSON body,
 * and a dependency to do that is a dependency to audit, update and explain. The
 * whole adapter is forty lines and every one of them is readable.
 *
 * Selected by `MAIL_DRIVER=resend`; `env.ts` refuses to start without the API
 * key when it is. Nothing above `MailerPort` changes: the same worker that
 * printed to a console locally posts here.
 *
 * ── The two error shapes, and why they are different ────────────────────────
 * A **5xx or a network failure** is Resend having a bad day. It is retryable,
 * and the worker's backoff exists precisely for it.
 *
 * A **4xx** is us: an unverified sending domain, a malformed address, a revoked
 * key. Retrying that five times with backoff wastes twenty minutes and then
 * produces the same failure, so it is marked permanent and the delivery row
 * carries the provider's own sentence — which is usually the exact instruction
 * needed ("The domain is not verified").
 */
const ENDPOINT = 'https://api.resend.com/emails';

/** Resend tag names and values only accept this provider-specific alphabet. */
function resendTagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
}

/** Marks a failure the worker must not retry. See the note above. */
export class PermanentMailError extends Error {
  readonly permanent = true;
}

export function createResendMailer(fetchImpl: typeof fetch = fetch): MailerPort {
  return {
    driver: 'resend',

    async send(message: MailMessage): Promise<MailResult> {
      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            // The key is a header, never a query parameter: URLs end up in
            // access logs and this one is a credential.
            Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
            'Content-Type': 'application/json',
            /*
             * Resend deduplicates on this for 24 hours. It is the second line
             * of defence, not the first — `notification_deliveries.dedupeKey`
             * is a unique index and is ours — and it covers the one window
             * that index cannot: a row claimed, a request sent, and the
             * response lost on the way back.
             */
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            tags: [{ name: 'template', value: resendTagValue(message.tag) }],
          }),
        });
      } catch (error) {
        // DNS, TLS, a dropped socket. Always retryable.
        throw new UpstreamUnavailableError('Resend could not be reached.', {
          code: 'MAIL_PROVIDER_UNAVAILABLE',
          cause: error,
        });
      }

      if (!response.ok) {
        // The provider's sentence, bounded. Never the body we sent.
        const detail = (await response.text().catch(() => '')).slice(0, 500);
        logger.error(
          { channel: 'email', driver: 'resend', status: response.status, tag: message.tag },
          'resend rejected the message',
        );

        if (response.status >= 400 && response.status < 500) {
          throw new PermanentMailError(`Resend refused it (${String(response.status)}): ${detail}`);
        }
        throw new UpstreamUnavailableError(
          `Resend answered ${String(response.status)}: ${detail}`,
          { code: 'MAIL_PROVIDER_UNAVAILABLE' },
        );
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { providerMessageId: body.id ?? null };
    },
  };
}
