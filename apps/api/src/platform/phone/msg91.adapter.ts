import { env } from '../../config/env.js';
import { UnauthorizedError, UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';
import type { PhoneVerifierPort } from './phone.port.js';

const ENDPOINT = 'https://control.msg91.com/api/v5/otp';

/** MSG91 SendOTP v5 (https://docs.msg91.com/otp), not notifications or the widget.
 * MSG91 generates the code. Never log URLs or response bodies: Verify uses a
 * code in its query string. No automatic retry of chargeable sends.
 */
export function createMsg91PhoneVerifier(
  fetchImpl: typeof fetch = fetch,
  options = {
    authKey: env.MSG91_AUTH_KEY ?? '',
    templateId: env.MSG91_OTP_TEMPLATE_ID ?? '',
    timeoutMs: env.MSG91_OTP_TIMEOUT_MS,
  },
): PhoneVerifierPort {
  async function request(
    url: URL,
    method: 'GET' | 'POST',
  ): Promise<{ type: string; message: string }> {
    try {
      const response = await fetchImpl(url, {
        method,
        headers: { authkey: options.authKey, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
        signal: AbortSignal.timeout(options.timeoutMs),
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('provider HTTP failure');
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !('type' in body) ||
        !('message' in body) ||
        typeof body.type !== 'string' ||
        typeof body.message !== 'string'
      ) {
        throw new Error('provider response shape');
      }
      return { type: body.type, message: body.message };
    } catch {
      // A fetch Error can contain the URL and OTP. Do not attach it.
      throw unavailable();
    }
  }

  return {
    driver: 'msg91',
    async send(phone) {
      const url = new URL(ENDPOINT);
      url.searchParams.set('template_id', options.templateId);
      url.searchParams.set('mobile', phone.slice(1));
      url.searchParams.set('otp_length', '6');
      url.searchParams.set('otp_expiry', '5');
      const result = await request(url, 'POST');
      if (result.type !== 'success' || !result.message) throw unavailable();
    },
    async verify(phone, code) {
      const url = new URL(`${ENDPOINT}/verify`);
      url.searchParams.set('mobile', phone.slice(1));
      url.searchParams.set('otp', code);
      const result = await request(url, 'GET');
      // Never accept an "already verified" response as fresh proof.
      const message = result.message.toLowerCase().trim();
      if (result.type === 'success' && message === 'otp verified success') return;
      if (message === 'invalid otp' || message === 'otp not match') {
        throw new UnauthorizedError('That code is not right. Check it and try again.', {
          code: 'PHONE_CODE_INVALID',
        });
      }
      if (
        message === 'otp expired' ||
        message === 'mobile no. already verified' ||
        message === 'mobile already verified'
      ) {
        throw new UnauthorizedError('That code has expired. Send a new one.', {
          code: 'PHONE_CODE_EXPIRED',
        });
      }
      throw unavailable();
    },
  };
}

function unavailable(): UpstreamUnavailableError {
  logger.warn({ provider: 'msg91' }, 'phone verification provider unavailable');
  return new UpstreamUnavailableError(
    'Phone verification is temporarily unavailable. Try again shortly.',
    {
      code: 'PHONE_VERIFICATION_UNAVAILABLE',
    },
  );
}
