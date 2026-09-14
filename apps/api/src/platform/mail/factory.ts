import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import { createConsoleMailer } from './console.adapter.js';
import { mailDeliverabilityIssues } from './deliverability.js';
import { createResendMailer } from './resend.adapter.js';
import type { MailerPort } from './mail.port.js';

export function createMailer(): MailerPort {
  for (const issue of mailDeliverabilityIssues(env)) {
    logger.warn(
      {
        event: 'mail.deliverability.configuration',
        code: issue.code,
        senderDomain: issue.senderDomain,
        linkHost: issue.linkHost,
      },
      issue.message,
    );
  }
  return env.MAIL_DRIVER === 'resend' ? createResendMailer() : createConsoleMailer();
}
