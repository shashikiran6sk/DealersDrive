import { env } from '../../config/env.js';
import { createConsoleSms } from './console.adapter.js';
import { createDisabledSms } from './disabled.adapter.js';
import { createMsg91Sms } from './msg91.adapter.js';
import type { SmsPort } from './sms.port.js';

export function createSms(): SmsPort {
  if (env.SMS_DRIVER === 'msg91') return createMsg91Sms();
  if (env.SMS_DRIVER === 'disabled') return createDisabledSms();
  return createConsoleSms();
}
