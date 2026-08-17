import { logger } from '../telemetry/logger.js';

/**
 * Email and SMS behind one narrow port. Both are mocked for the current build
 * (CLAUDE.md §8): a console adapter prints what would have been sent, which is
 * enough to prove the outbox actually fires and the 30-second path is wired.
 *
 * `ResendMailer` and `Msg91Sms` slot in here without touching a caller.
 */
export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface MailerPort {
  send(message: MailMessage): Promise<void>;
}

export interface SmsPort {
  send(message: SmsMessage): Promise<void>;
}

export function createConsoleMailer(): MailerPort {
  return {
    async send(message) {
      logger.info({ channel: 'email', to: message.to, subject: message.subject }, message.body);
      await Promise.resolve();
    },
  };
}

export function createConsoleSms(): SmsPort {
  return {
    async send(message) {
      logger.info({ channel: 'sms', to: message.to }, message.body);
      await Promise.resolve();
    },
  };
}
