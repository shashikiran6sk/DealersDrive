import { logger } from '../telemetry/logger.js';
import type { MailerPort, MailMessage, MailResult } from './mail.port.js';

/**
 * Prints what would have been sent (**R40**).
 *
 * The default, and what `pnpm dev` and the whole test suite run on. It is not a
 * no-op: it logs the recipient, the subject and the **plain-text body**, which
 * is the part a developer actually needs to check — a template that renders
 * `undefined` into a sentence is invisible in HTML and obvious here.
 *
 * Everything above it is unchanged. The same worker, the same idempotency
 * claim, the same `SENT` row. Only the network call is replaced, which is what
 * makes "does the approval email fire" answerable without a Resend account.
 */
export function createConsoleMailer(): MailerPort {
  return {
    driver: 'console',

    send(message: MailMessage): Promise<MailResult> {
      logger.info(
        {
          channel: 'email',
          driver: 'console',
          to: message.to,
          subject: message.subject,
          tag: message.tag,
        },
        // The body on its own line, so it is readable in a terminal rather than
        // folded into a JSON field.
        `\n──── email (not sent) ────\n${message.text}\n──────────────────────────`,
      );
      return Promise.resolve({ providerMessageId: null });
    },
  };
}
