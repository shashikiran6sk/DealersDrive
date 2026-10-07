import { env } from '../../config/env.js';
import { isRecord, UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import { maskPhone, msisdnOf } from './mask.js';
import { PermanentSmsError, type SmsMessage, type SmsPort, type SmsResult } from './sms.port.js';

const ENDPOINT = 'https://control.msg91.com/api/v5/flow';
const DETAIL_LIMIT = 300;

export function createMsg91Sms(fetchImpl: typeof fetch = fetch): SmsPort {
  return {
    driver: 'msg91',

    async send(message: SmsMessage): Promise<SmsResult> {
      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            authkey: env.MSG91_AUTH_KEY ?? '',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            template_id: message.templateId,
            short_url: '0',
            recipients: [{ mobiles: msisdnOf(message.to), ...message.variables }],
          }),
          signal: AbortSignal.timeout(env.SMS_TIMEOUT_MS),
        });
      } catch (error) {
        throw new UpstreamUnavailableError('MSG91 could not be reached.', {
          code: 'SMS_PROVIDER_UNAVAILABLE',
          cause: error,
        });
      }

      const body: unknown = await response.json().catch(() => null);
      const detail = messageOf(body);

      if (response.ok && isSuccess(body)) {
        return { providerMessageId: detail || null };
      }

      logger.error(
        {
          channel: 'sms',
          driver: 'msg91',
          status: response.status,
          tag: message.tag,
          to: maskPhone(message.to),
          providerMessage: detail,
        },
        'msg91 refused the message',
      );

      if (response.status >= 500 || response.status === 429) {
        throw new UpstreamUnavailableError(`MSG91 answered ${String(response.status)}: ${detail}`, {
          code: 'SMS_PROVIDER_UNAVAILABLE',
        });
      }
      throw new PermanentSmsError(`MSG91 refused it (${String(response.status)}): ${detail}`);
    },
  };
}

function isSuccess(body: unknown): boolean {
  return isRecord(body) && typeof body.type === 'string' && body.type.toLowerCase() === 'success';
}

function messageOf(body: unknown): string {
  if (!isRecord(body)) return '';
  const value = body.message;
  return typeof value === 'string' ? value.slice(0, DETAIL_LIMIT) : '';
}
