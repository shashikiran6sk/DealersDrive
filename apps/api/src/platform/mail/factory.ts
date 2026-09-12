import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import { createConsoleMailer } from './console.adapter.js';
import { mailDeliverabilityIssues } from './deliverability.js';
import { createResendMailer } from './resend.adapter.js';
import type { MailerPort } from './mail.port.js';

/**
 * The `MAIL_DRIVER` seam, resolved once in the container (**R40**).
 *
 * `env.ts` refuses `resend` without an API key and refuses `console` in
 * production, so neither branch can be reached in a state it cannot serve — the
 * failure is a refused boot naming a variable, rather than a dealer never
 * hearing that their application was approved.
 *
 * `smtp` is in the enum and is **not implemented**; `env.ts` refuses it at boot
 * and says so. It was in the baseline's enum too and had no adapter there
 * either. Wiring Mailpit would mean an SMTP client, which means a dependency,
 * for a local convenience the console driver already covers — and the console
 * driver prints the plain-text body, which is more useful for checking a
 * template than a rendered message in a web inbox.
 */
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
