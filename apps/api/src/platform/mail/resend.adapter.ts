import { env } from '../../config/env.js';
import { UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import type { MailerPort, MailMessage, MailResult } from './mail.port.js';

const ENDPOINT = 'https://api.resend.com/emails';

function resendTagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
}

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
            Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            reply_to: env.SUPPORT_EMAIL,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            tags: [{ name: 'template', value: resendTagValue(message.tag) }],
          }),
        });
      } catch (error) {
        throw new UpstreamUnavailableError('Resend could not be reached.', {
          code: 'MAIL_PROVIDER_UNAVAILABLE',
          cause: error,
        });
      }

      if (!response.ok) {
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

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the provider's response body is untyped
      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { providerMessageId: body.id ?? null };
    },
  };
}
