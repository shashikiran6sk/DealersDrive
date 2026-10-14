import { z } from 'zod';

import { env } from '../../config/env.js';
import { DomainError, UpstreamUnavailableError } from '../errors.js';
import { NATIVE_WIDGET_MESSAGES } from './native-widget.messages.js';
import type { NativeWidgetPort } from './native-widget.port.js';

const Result = z.object({
  type: z.literal('success'),
  message: z.string().optional(),
  'access-token': z.string().optional(),
});
const RequestId = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export function createNativeWidget(fetcher: typeof fetch = fetch): NativeWidgetPort {
  async function call(path: string, fields: Record<string, string | number>) {
    if (!env.MSG91_WIDGET_ID || !env.MSG91_WIDGET_TOKEN) throw unavailable();
    let response: Response;
    try {
      response = await fetcher(`https://control.msg91.com/api/v5/widget/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          widgetId: env.MSG91_WIDGET_ID,
          tokenAuth: env.MSG91_WIDGET_TOKEN,
          ...fields,
        }),
        signal: AbortSignal.timeout(env.PHONE_OTP_TIMEOUT_MS),
      });
    } catch {
      throw unavailable();
    }
    if (response.status >= 500 || response.status === 429) throw unavailable();
    const body: unknown = await response.json().catch(() => null);
    const result = Result.safeParse(body);
    if (!response.ok || !result.success) {
      if (path === 'verifyOtp')
        throw new DomainError('NATIVE_OTP_INVALID', NATIVE_WIDGET_MESSAGES.invalid);
      throw unavailable();
    }
    return result.data;
  }
  return {
    async send(phone) {
      const result = await call('sendOtp', { identifier: phone.replace(/^\+/, '') });
      const id = RequestId.safeParse(result.message);
      if (!id.success) throw unavailable();
      return id.data;
    },
    async resend(reqId) {
      const result = await call('retryOtp', { reqId, retryChannel: 11 });
      const id = RequestId.safeParse(result.message);
      if (!id.success) throw unavailable();
      return id.data;
    },
    async verify(reqId, otp) {
      const result = await call('verifyOtp', { reqId, otp });
      const token = result['access-token'] ?? result.message;
      if (!token || token.length > 4096 || token.split('.').length !== 3) throw unavailable();
      return token;
    },
  };
}
function unavailable(): UpstreamUnavailableError {
  return new UpstreamUnavailableError(NATIVE_WIDGET_MESSAGES.unavailable, {
    code: 'NATIVE_OTP_UNAVAILABLE',
  });
}
