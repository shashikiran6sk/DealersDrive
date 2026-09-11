import { env } from '../../config/env.js';
import { createFakePhoneVerifier } from './fake.adapter.js';
import { createMsg91PhoneVerifier } from './msg91.adapter.js';
import type { PhoneVerifierPort } from './phone.port.js';

export function createPhoneVerifier(): PhoneVerifierPort {
  return env.PHONE_VERIFICATION_DRIVER === 'msg91'
    ? createMsg91PhoneVerifier()
    : createFakePhoneVerifier();
}
