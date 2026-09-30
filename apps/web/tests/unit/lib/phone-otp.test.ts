import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from '@/lib/msg91-widget';
import { phoneOtpToken, sendPhoneOtp } from '@/lib/phone-otp';

/**
 * Delivery is the widget's: whichever MSG91 widget the server handed over is
 * the one loaded and asked to send — the WhatsApp-configured one when the
 * admin has WhatsApp OTP on, the SMS one otherwise. Nothing in the browser
 * picks a channel for itself, and verification is the same call either way.
 */
vi.mock('@/lib/msg91-widget', () => ({
  loadMsg91Widget: vi.fn(() => Promise.resolve()),
  sendMsg91Otp: vi.fn(() => Promise.resolve()),
  retryMsg91Otp: vi.fn(() => Promise.resolve()),
  verifyMsg91Otp: vi.fn(() => Promise.resolve('access-token')),
}));

function widget(channel: PhoneOtpWidget['channel'], widgetId: string): PhoneOtpWidget {
  return {
    enabled: true,
    driver: 'msg91',
    widgetId,
    tokenAuth: `${widgetId}-token`,
    devCode: null,
    reason: null,
    channel,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendPhoneOtp', () => {
  it.each([
    ['whatsapp', 'wa-widget'],
    ['sms', 'sms-widget'],
  ] as const)('sends through the %s widget the server chose', async (channel, widgetId) => {
    await sendPhoneOtp(widget(channel, widgetId), '98400 12345', {
      resend: false,
      captchaRenderId: 'captcha',
    });
    expect(loadMsg91Widget).toHaveBeenCalledWith({
      widgetId,
      tokenAuth: `${widgetId}-token`,
      captchaRenderId: 'captcha',
    });
    expect(sendMsg91Otp).toHaveBeenCalledWith('919840012345');
  });

  it('resends the same way on either channel', async () => {
    await sendPhoneOtp(widget('whatsapp', 'wa-widget'), '9840012345', {
      resend: true,
      captchaRenderId: 'captcha',
    });
    expect(retryMsg91Otp).toHaveBeenCalledWith('919840012345');
    expect(sendMsg91Otp).not.toHaveBeenCalled();
  });

  it('does not claim a send the widget refused', async () => {
    vi.mocked(sendMsg91Otp).mockRejectedValueOnce(new Error('WhatsApp delivery failed'));
    await expect(
      sendPhoneOtp(widget('whatsapp', 'wa-widget'), '9840012345', {
        resend: false,
        captchaRenderId: 'captcha',
      }),
    ).rejects.toThrow('WhatsApp delivery failed');
  });

  it('sends nothing under the development driver, whatever the channel says', async () => {
    await sendPhoneOtp(
      { ...widget('whatsapp', 'wa-widget'), driver: 'fake', widgetId: null, tokenAuth: null },
      '9840012345',
      { resend: false, captchaRenderId: 'captcha' },
    );
    expect(loadMsg91Widget).not.toHaveBeenCalled();
    expect(sendMsg91Otp).not.toHaveBeenCalled();
  });
});

describe('phoneOtpToken', () => {
  it('verifies identically whichever channel delivered the code', async () => {
    await expect(phoneOtpToken(widget('whatsapp', 'wa'), '9840012345', '123456')).resolves.toBe(
      'access-token',
    );
    await expect(phoneOtpToken(widget('sms', 'sms'), '9840012345', '123456')).resolves.toBe(
      'access-token',
    );
    expect(verifyMsg91Otp).toHaveBeenCalledTimes(2);
    expect(verifyMsg91Otp).toHaveBeenNthCalledWith(1, '123456');
    expect(verifyMsg91Otp).toHaveBeenNthCalledWith(2, '123456');
  });
});
