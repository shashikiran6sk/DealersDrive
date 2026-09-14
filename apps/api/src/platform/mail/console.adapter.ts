import { logger } from '../telemetry/logger.js';
import type { MailerPort, MailMessage, MailResult } from './mail.port.js';

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
        `\n──── email (not sent) ────\n${message.text}\n──────────────────────────`,
      );
      return Promise.resolve({ providerMessageId: null });
    },
  };
}
