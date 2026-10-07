import type { SmsPort, SmsResult } from './sms.port.js';

export function createDisabledSms(): SmsPort {
  return {
    driver: 'disabled',

    send(): Promise<SmsResult> {
      return Promise.resolve({ providerMessageId: null });
    },
  };
}
