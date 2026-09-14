import { env } from '../../config/env.js';
import { logger } from '../telemetry/logger.js';
import type { MsisdnDigits, PhoneOtpPort, PhoneOtpVerdict } from './phone-otp.port.js';

const ENDPOINT = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

const IDENTIFIER_CLAIMS = ['identifier', 'mobile', 'number', 'phone', 'msisdn'] as const;

export function createMsg91PhoneOtp(fetchImpl: typeof fetch = fetch): PhoneOtpPort {
  return {
    driver: 'msg91',

    async identify(accessToken: string): Promise<PhoneOtpVerdict> {
      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            authkey: env.MSG91_AUTH_KEY ?? '',
            'access-token': accessToken,
          }),
          signal: AbortSignal.timeout(env.PHONE_OTP_TIMEOUT_MS),
        });
      } catch (error) {
        logger.warn({ err: error, driver: 'msg91' }, 'msg91 access-token verification unreachable');
        return { status: 'UNAVAILABLE' };
      }

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok || !isSuccess(body)) {
        logger.info(
          { driver: 'msg91', status: response.status, providerMessage: messageOf(body) },
          'msg91 refused an access token',
        );
        return { status: 'REJECTED', reason: 'the provider refused the token' };
      }

      const identifier = identifierFromBody(body) ?? identifierFromToken(accessToken);
      if (!identifier) {
        logger.error(
          { driver: 'msg91', status: response.status },
          'msg91 verified an access token that names no identifier',
        );
        return { status: 'REJECTED', reason: 'the provider named no identifier' };
      }

      return { status: 'VERIFIED', identifier };
    },
  };
}

function isSuccess(body: unknown): boolean {
  return isRecord(body) && text(body.type).toLowerCase() === 'success';
}

function messageOf(body: unknown): string {
  return isRecord(body) ? text(body.message).slice(0, 200) : '';
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function identifierFromBody(body: unknown): MsisdnDigits | null {
  if (!isRecord(body)) return null;

  for (const key of [...IDENTIFIER_CLAIMS, 'message']) {
    const found = asIdentifier(body[key]);
    if (found) return found;
  }
  return null;
}

function identifierFromToken(accessToken: string): MsisdnDigits | null {
  const segments = accessToken.split('.');
  if (segments.length !== 3 || !segments[1]) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  for (const claim of IDENTIFIER_CLAIMS) {
    const found = asIdentifier(payload[claim]);
    if (found) return found;
  }
  return null;
}

function asIdentifier(value: unknown): MsisdnDigits | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(/^\+/, '');
  return /^\d{8,15}$/.test(text) ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
