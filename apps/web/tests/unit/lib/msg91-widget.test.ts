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
  initSendOTP: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  sendOtp: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
}

/**
 * How long the widget waits before attaching its methods, in ms. `0` is the
 * old assumption — that `initSendOTP` returning means ready — and anything
 * above it is what actually happens: the widget fetches its configuration
 * first.
 */
let exposeAfterMs = 0;

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
    /*
     * The script defines `initSendOTP` and nothing else. The three methods are
     * attached by *calling* it, after the widget has fetched its configuration
     * — which is the gap the loader has to wait out, and the gap that used to
     * swallow a `sendOtp` call whole.
     */
    Object.assign(window, {
      initSendOTP: (...args: unknown[]) => {
        fake.initSendOTP(...args);
        const expose = () => {
          Object.assign(window, {
            sendOtp: fake.sendOtp,
            retryOtp: vi.fn(),
            verifyOtp: fake.verifyOtp,
          });
        };
        if (exposeAfterMs === 0) expose();
        else setTimeout(expose, exposeAfterMs);
      },
    });
    node.onload?.(new Event('load'));
  }) as typeof document.head.append);

  return fake;
}

beforeEach(() => {
  resetMsg91Widget();
  exposeAfterMs = 0;
  // The loader polls for readiness and every call carries a deadline, so the
  // cases below drive the clock rather than wait on it.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

  it('rejects before the script is loaded rather than calling nothing', async () => {
    await expect(verifyMsg91Otp('123456')).rejects.toThrow('not loaded');
  });
});

/**
 * The two ways a callback API hangs, and the reason this module wraps them at
 * all (**R39**).
 *
 * Both of these were real: pressing **Send OTP** against a live widget span an
 * spinner for ever, sent no message and showed no error. A promise that never
 * settles is the worst failure mode a UI can have, because there is nothing to
 * report and nothing to retry — so both are now rejections.
 */
describe('a widget that is not ready yet', () => {
  it('waits for the methods instead of calling into nothing', async () => {
    exposeAfterMs = 300;
    const fake = installScript();

    const loaded = loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });
    // `initSendOTP` has returned, and `sendOtp` is still undefined — which is
    // exactly the window the old code resolved in.
    expect((window as unknown as Record<string, unknown>).sendOtp).toBeUndefined();

    await vi.advanceTimersByTimeAsync(400);
    await loaded;
    await sendMsg91Otp('919840012345');

    expect(fake.sendOtp).toHaveBeenCalledOnce();
  });

  it('gives up rather than waiting for methods that never arrive', async () => {
    exposeAfterMs = 60_000;
    installScript();

    const loaded = loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' }).catch(
      (error: Error) => error.message,
    );
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(loaded).resolves.toMatch(/did not finish starting up/);
  });
});

describe('a widget that never answers', () => {
  it('rejects rather than leaving the caller waiting for ever', async () => {
    const fake = installScript();
    // Called, and neither callback ever invoked. Nothing is thrown, nothing is
    // logged, and before the timeout nothing ever resolved either.
    fake.sendOtp.mockImplementation(() => undefined);
    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });

    const pending = sendMsg91Otp('919840012345').catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(25_000);

    await expect(pending).resolves.toMatch(/did not respond to sendOtp/);
  });

  it('does the same for a code that is never judged', async () => {
    const fake = installScript();
    fake.verifyOtp.mockImplementation(() => undefined);
    await loadMsg91Widget({ widgetId: 'w1', tokenAuth: 't1' });

    const pending = verifyMsg91Otp('123456').catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(25_000);

    await expect(pending).resolves.toMatch(/did not respond to verifyOtp/);
  });
});
