import { normaliseIndianMobile, type PhoneOtpWidget } from '@dealers-drive/contracts';

import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from './msg91-widget';

export function identifierOf(phone: string): string {
  const canonical = normaliseIndianMobile(phone);
  if (canonical) return canonical.slice(1);

  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
}

export async function sendPhoneOtp(
  widget: PhoneOtpWidget,
  phone: string,
  options: { resend: boolean; captchaRenderId: string },
): Promise<void> {
  if (widget.driver !== 'msg91') return;

  await loadMsg91Widget({
    widgetId: widget.widgetId ?? '',
    tokenAuth: widget.tokenAuth ?? '',
    captchaRenderId: options.captchaRenderId,
  });

  if (options.resend) await retryMsg91Otp(identifierOf(phone));
  else await sendMsg91Otp(identifierOf(phone));
}

export async function phoneOtpToken(
  widget: PhoneOtpWidget,
  phone: string,
  code: string,
): Promise<string> {
  return widget.driver === 'msg91'
    ? verifyMsg91Otp(code)
    : `dev-otp:${identifierOf(phone)}:${code}:${String(Date.now())}`;
}
