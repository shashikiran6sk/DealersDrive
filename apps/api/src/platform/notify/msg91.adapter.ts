import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import type { SmsPort, SmsMessage } from './notify.port.js';

/**
 * MSG91 — the production SMS provider (CLAUDE.md §9).
 *
 * Selected by `SMS_DRIVER=msg91`; `env.ts` refuses to start without the auth key
 * and sender id when it is. Nothing above `SmsPort` changes: the same
 * notification handler that printed to a console locally posts to MSG91 here.
 *
 * **Verified against the documented API shape, not against MSG91 itself** —
 * this build has no MSG91 account, so the request is unit-tested with a stubbed
 * `fetch` and the first real send should be watched. India also requires DLT
 * registration of the entity, the sender header and each template before any
 * transactional SMS is delivered (ARCHITECTURE §8.1).
 */
const ENDPOINT = 'https://control.msg91.com/api/v5/flow/';

export function createMsg91Sms(fetchImpl: typeof fetch = fetch): SmsPort {
  return {
    async send(message: SmsMessage): Promise<void> {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The auth key is a header, never a query parameter: URLs end up in
          // access logs and this one is a credential.
          authkey: env.MSG91_AUTH_KEY ?? '',
        },
        body: JSON.stringify({
          sender: env.MSG91_SENDER_ID,
          short_url: '0',
          recipients: [{ mobiles: digitsOf(message.to), body: message.body }],
        }),
      });

      if (!response.ok) {
        // The number is logged; the message body and the auth key are not.
        logger.error(
          { channel: 'sms', status: response.status, to: message.to },
          'msg91 send failed',
        );
        throw new Error(`MSG91 rejected the message with status ${response.status}.`);
      }
    },
  };
}

/** MSG91 wants `919840012345`, not `+919840012345`. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}
