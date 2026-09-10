import { env } from '../../config/env.js';
import { createFakePhoneVerifier } from './fake.adapter.js';
import { createFirebasePhoneVerifier } from './firebase.adapter.js';
import type { PhoneVerifierPort } from './phone.port.js';

/**
 * The `PHONE_VERIFICATION_DRIVER` seam, resolved once in the container.
 *
 * `env.ts` refuses `fake` in production and refuses `firebase` without a
 * project id, so neither branch here can be reached in a state it cannot
 * serve — the failure is a refused boot with a named variable rather than a
 * dealer discovering it at the OTP screen.
 */
export function createPhoneVerifier(): PhoneVerifierPort {
  return env.PHONE_VERIFICATION_DRIVER === 'firebase'
    ? createFirebasePhoneVerifier()
    : createFakePhoneVerifier();
}
