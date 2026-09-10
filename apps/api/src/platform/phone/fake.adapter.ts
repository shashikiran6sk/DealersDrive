import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import type { PhoneVerifierPort, VerifiedPhone } from './phone.port.js';

/**
 * Phone verification without Firebase, an SMS or a network (**R39**).
 *
 * Selected by `PHONE_VERIFICATION_DRIVER=fake`, which is the default and which
 * `env.ts` refuses in production. It is what makes the whole flow runnable on
 * `pnpm dev` with no Firebase project, and what lets the integration suite
 * assert on a verified dealership without anybody's phone ringing.
 *
 * **It is a driver, not a stub.** Everything above it runs unmodified: the same
 * route, the same service, the same duplicate check, the same write. The only
 * thing replaced is the question "did Google sign this".
 *
 * ── The token format ────────────────────────────────────────────────────────
 *
 *     fake:+919840012345
 *     fake:+919840012345:123456
 *
 * The optional third part is the code the caller claims to have entered. When
 * present it must equal `PHONE_VERIFICATION_FAKE_CODE` (default `123456`),
 * which is what makes the *wrong code* path exercisable locally — a developer
 * who cannot see a rejection cannot check that the screen handles one.
 */
export function createFakePhoneVerifier(): PhoneVerifierPort {
  return {
    driver: 'fake',

    verify(idToken: string): Promise<VerifiedPhone> {
      const parts = idToken.split(':');
      if (parts[0] !== 'fake' || parts.length < 2 || parts.length > 3) {
        return Promise.reject(
          new UnauthorizedError('That verification could not be checked. Try again.', {
            code: 'PHONE_TOKEN_INVALID',
          }),
        );
      }

      const phone = parts[1] ?? '';
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        return Promise.reject(
          new UnauthorizedError('That verification could not be checked. Try again.', {
            code: 'PHONE_TOKEN_INVALID',
          }),
        );
      }

      if (parts.length === 3 && parts[2] !== env.PHONE_VERIFICATION_FAKE_CODE) {
        return Promise.reject(
          new UnauthorizedError('That code is not right. Check it and try again.', {
            code: 'PHONE_CODE_INVALID',
          }),
        );
      }

      logger.warn(
        { provider: 'fake', phone },
        'phone verified by the fake driver — no SMS was sent and nothing was proved',
      );

      return Promise.resolve({
        phone,
        providerUserId: `fake:${phone}`,
        authenticatedAt: new Date(),
      });
    },
  };
}
