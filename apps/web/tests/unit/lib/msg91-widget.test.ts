import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadMsg91Widget,
  resetMsg91Widget,
  sendMsg91Otp,
  verifyMsg91Otp,
} from '@/lib/msg91-widget';

/**
 * R39 — the browser half of the MSG91 integration.
 *
 * The provider's script is never fetched here: what is tested is the contract
 * this module holds it to. Three things matter and none of them is the network
 * call —
 *
 *   · `initSendOTP` runs **once**, with `exposeMethods` on, because a second
 *     initialisation is two widgets racing over the same globals and a code
 *     sent twice;
 *   · `verifyOtp`'s access token is found wherever the provider put it, and a
 *     payload with no token is an error rather than an empty string posted to
 *     the API;
 *   · a refusal from the widget rejects, so the panel shows the failed state
 *     instead of a hopeful one.
 */
interface FakeWidget {
  initSendOTP: ReturnType<typeof vi.fn>;
  sendOtp: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
}

function installScript(): FakeWidget {
  const fake: FakeWidget = {
    initSendOTP: vi.fn(),
    sendOtp: vi.fn((_id: string, success: (data: unknown) => void) => {
      success({ type: 'success' });
    }),
    verifyOtp: vi.fn(),
  };

  // Stand in for the provider's `<script>`: appending it fires `onload`, which
  // is where `initSendOTP` is called from.
  vi.spyOn(document.head, 'append').mockImplementation(((node: HTMLScriptElement) => {
    Object.assign(window, fake);
    node.onload?.(new Event('load'));
  }) as typeof document.head.append);

  return fake;
}

beforeEach(() => {
  resetMsg91Widget();
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ['initSendOTP', 'sendOtp', 'retryOtp', 'verifyOtp']) {
    delete (window as unknown as Record<string, unknown>)[key];
  }
});

describe('loadMsg91Widget', () => {
  it('initialises the widget with the methods exposed, so no modal appears', async () => {
    const fake = installScript();

    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1', captchaRenderId: 'captcha' });

    expect(fake.initSendOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetId: 'w1',
        tokenAuth: 't1',
        exposeMethods: true,
        captchaRenderId: 'captcha',
      }),
    );
  });

  it('loads once, however many times it is asked', async () => {
    const fake = installScript();

    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });
    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });

    expect(fake.initSendOTP).toHaveBeenCalledTimes(1);
  });

  it('passes the identifier through with its country code', async () => {
    const fake = installScript();
    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });

    await sendMsg91Otp('919840012345');

    expect(fake.sendOtp).toHaveBeenCalledWith(
      '919840012345',
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe('verifyMsg91Otp', () => {
  async function ready(): Promise<FakeWidget> {
    const fake = installScript();
    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });
    return fake;
  }

  it.each([
    ['message', { type: 'success', message: 'jwt-token' }],
    ['accessToken', { accessToken: 'jwt-token' }],
    ['access-token', { 'access-token': 'jwt-token' }],
    ['a bare string', 'jwt-token'],
  ])('finds the access token under %s', async (_label, payload) => {
    const fake = await ready();
    fake.verifyOtp.mockImplementation((_code: string, success: (data: unknown) => void) => {
      success(payload);
    });

    await expect(verifyMsg91Otp('123456')).resolves.toBe('jwt-token');
  });

  /** An empty string posted to the API would be a refusal wearing a success. */
  it('rejects a success that carries no token', async () => {
    const fake = await ready();
    fake.verifyOtp.mockImplementation((_code: string, success: (data: unknown) => void) => {
      success({ type: 'success' });
    });

    await expect(verifyMsg91Otp('123456')).rejects.toThrow('no access token');
  });

  it('rejects when the widget refuses the code', async () => {
    const fake = await ready();
    fake.verifyOtp.mockImplementation(
      (_code: string, _success: unknown, failure: (error: unknown) => void) => {
        failure(new Error('OTP not verified'));
      },
    );

    await expect(verifyMsg91Otp('000000')).rejects.toThrow('OTP not verified');
  });

  it('rejects before the widget is ready rather than calling nothing', async () => {
    await expect(verifyMsg91Otp('123456')).rejects.toThrow('not ready');
  });
});
