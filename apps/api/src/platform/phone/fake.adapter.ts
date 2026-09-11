import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors.js';
import type { PhoneVerifierPort } from './phone.port.js';

/** Local only. Challenge ownership, expiry and limits remain real. */
export function createFakePhoneVerifier(): PhoneVerifierPort {
  return {
    driver: 'fake',
    send: () => Promise.resolve(),
    verify: (_phone, code) => {
      if (code !== env.PHONE_VERIFICATION_FAKE_CODE) {
        return Promise.reject(
          new UnauthorizedError('That code is not right. Check it and try again.', {
            code: 'PHONE_CODE_INVALID',
          }),
        );
      }
      return Promise.resolve();
    },
  };
}
