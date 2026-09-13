/**
 * The MSG91 OTP widget, wrapped in promises (**R39**).
 *
 * The provider ships a script that attaches `sendOtp`, `retryOtp` and
 * `verifyOtp` to `window` when `initSendOTP` is called with
 * `exposeMethods: true`. That flag is what suppresses MSG91's own modal, which
 * is the whole reason this integration is worth doing by hand: the product's
 * sign-up screen keeps its own design, its own copy and its own error states,
 * and the provider supplies only the send and the check.
 *
 * Everything here is browser-side and deliberately shallow. **None of it is
 * trusted.** The token these calls produce is meaningless until the API takes
 * it to MSG91 with the server-only auth key; a page that decided for itself
 * that a number was verified would be a page that could be told to.
 *
 * ── Why a module-level promise ──────────────────────────────────────────────
 * `initSendOTP` configures one widget per page, and the callbacks it is given
 * are the ones it keeps. Loading the script twice, or re-initialising it on a
 * re-render, produces two widgets racing over the same globals — which shows up
 * as duplicated success events and an OTP sent twice. It is loaded once, and
 * the second caller waits on the same promise.
 */

/** What `initSendOTP` is handed. Only the fields this product sets. */
interface Msg91Configuration {
  widgetId: string;
  tokenAuth: string;
  exposeMethods: true;
  captchaRenderId?: string;
  success: (data: unknown) => void;
  failure: (error: unknown) => void;
}

type Msg91Callback = (data: unknown) => void;

interface Msg91Window extends Window {
  initSendOTP?: (configuration: Msg91Configuration) => void;
  sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
  retryOtp?: (
    channel: string | null,
    success?: Msg91Callback,
    failure?: Msg91Callback,
    reqId?: string,
  ) => void;
  verifyOtp?: (
    otp: string,
    success?: Msg91Callback,
    failure?: Msg91Callback,
    reqId?: string,
  ) => void;
}

const SCRIPT_SRC = 'https://verify.msg91.com/otp-provider.js';
const SCRIPT_ID = 'msg91-otp-provider';

let loading: Promise<Msg91Window> | null = null;

/**
 * Load and initialise the widget, once.
 *
 * The configuration's own `success` and `failure` are given no-ops on purpose.
 * `verifyOtp` takes its own pair, and MSG91's documentation is explicit that
 * listening to both produces duplicate events — so the per-call callbacks are
 * the ones this module uses, and the widget-level pair exists only because the
 * configuration requires it.
 */
export function loadMsg91Widget(config: {
  widgetId: string;
  tokenAuth: string;
  captchaRenderId?: string;
}): Promise<void> {
  loading ??= new Promise<Msg91Window>((resolve, reject) => {
    const target = window as Msg91Window;

    const initialise = (): void => {
      if (!target.initSendOTP) {
        reject(new Error('The verification widget loaded without initSendOTP.'));
        return;
      }
      target.initSendOTP({
        widgetId: config.widgetId,
        tokenAuth: config.tokenAuth,
        exposeMethods: true,
        ...(config.captchaRenderId ? { captchaRenderId: config.captchaRenderId } : {}),
        success: () => undefined,
        failure: () => undefined,
      });
      resolve(target);
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      initialise();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = initialise;
    script.onerror = () => {
      // Cleared so a dealer on a flaky connection can press the button again
      // rather than being stuck with a rejected promise for the page's life.
      loading = null;
      script.remove();
      reject(new Error('The verification service could not be loaded.'));
    };
    document.head.append(script);
  });

  return loading.then(() => undefined);
}

/** `sendOtp`. `identifier` is digits with the country code and no `+`. */
export function sendMsg91Otp(identifier: string): Promise<void> {
  return call((target, resolve, reject) => {
    target.sendOtp?.(
      identifier,
      () => {
        resolve(undefined);
      },
      reject,
    );
  });
}

/** `retryOtp`. `null` is the documented channel value for a default widget. */
export function retryMsg91Otp(): Promise<void> {
  return call((target, resolve, reject) => {
    target.retryOtp?.(
      null,
      () => {
        resolve(undefined);
      },
      reject,
    );
  });
}

/**
 * `verifyOtp`, resolved to the access token the API will check.
 *
 * The token's location in the success payload is not something to guess at, and
 * MSG91 has shipped it under more than one key — so every plausible one is
 * looked at and a failure to find it is an error rather than an empty string
 * posted to the API.
 */
export function verifyMsg91Otp(code: string): Promise<string> {
  return call<string>((target, resolve, reject) => {
    target.verifyOtp?.(
      code,
      (data) => {
        const token = accessTokenOf(data);
        if (token) resolve(token);
        else reject(new Error('The verification service returned no access token.'));
      },
      reject,
    );
  });
}

function call<T>(
  run: (target: Msg91Window, resolve: (value: T) => void, reject: (error: unknown) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const target = window as Msg91Window;
    if (!target.initSendOTP) {
      reject(new Error('The verification widget is not ready.'));
      return;
    }
    run(target, resolve, reject);
  });
}

function accessTokenOf(data: unknown): string | null {
  if (typeof data === 'string') return data.trim() || null;
  if (typeof data !== 'object' || data === null) return null;

  const record = data as Record<string, unknown>;
  for (const key of ['message', 'accessToken', 'access-token', 'token', 'jwt']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Test-only: forget the loaded widget so the next call re-initialises. */
export function resetMsg91Widget(): void {
  loading = null;
}
