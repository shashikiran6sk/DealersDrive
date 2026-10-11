import { logger } from '../telemetry/logger.js';
import { maskPhone } from './mask.js';
import type { SmsMessage, SmsPort, SmsResult } from './sms.port.js';

export function createConsoleSms(): SmsPort {
  return {
    driver: 'console',

    send(message: SmsMessage): Promise<SmsResult> {
      logger.info(
        {
          channel: 'sms',
          driver: 'console',
          to: maskPhone(message.to),
          tag: message.tag,
          templateId: message.templateId,
          variables: message.variables,
        },
        'sms (not sent)',
      );
      return Promise.resolve({ providerMessageId: null });
    },
  };
}
