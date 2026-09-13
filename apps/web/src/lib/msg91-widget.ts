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

/**
 * How long the widget has to attach its methods after `initSendOTP` returns.
 *
 * `initSendOTP` is synchronous but what it *starts* is not: the widget fetches
 * its configuration from MSG91 before it puts `sendOtp`, `retryOtp` and
 * `verifyOtp` on `window`. Fifteen seconds is generous for one request and far
 * short of a dealer's patience.
 */
const READY_TIMEOUT_MS = 15_000;

/**
 * How long one widget call has to invoke either of its callbacks.
 *
 * **The whole point is that there is a limit.** These are callback APIs wrapped
 * in promises, and a callback that is never invoked is a promise that never
 * settles — which is a spinner nobody can get out of, with no error anywhere.
 * A provider that goes quiet has to become a visible failure.
 */
const CALL_TIMEOUT_MS = 20_000;

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
        fail(new Error('The verification service loaded without initSendOTP.'));
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

      /*
       * **Not resolved here.** `initSendOTP` returning means the widget has
       * been *asked* to start, not that it is ready: it fetches its
       * configuration from MSG91 first, and only then attaches `sendOtp`,
       * `retryOtp` and `verifyOtp` to `window`.
       *
       * Resolving on the synchronous return let a caller invoke `sendOtp`
       * while it was still undefined — which did nothing at all, and left the
       * promise wrapping it waiting for a callback that could never come.
       */
      whenExposed(target).then(
        () => {
          resolve(target);
        },
        (error: unknown) => {
          fail(error);
        },
      );
    };

    /** Lets a dealer press the button again rather than be stuck for the page's life. */
    const fail = (error: unknown): void => {
      loading = null;
      reject(
        error instanceof Error ? error : new Error('The verification service could not be loaded.'),
      );
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Already on the page — but possibly still downloading, in which case
      // `initSendOTP` is not there yet and initialising now would fail for a
      // reason that is about timing rather than about anything being wrong.
      waitFor(() => typeof target.initSendOTP === 'function', READY_TIMEOUT_MS).then(
        initialise,
        () => {
          fail(new Error('The verification service could not be loaded.'));
        },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = initialise;
    script.onerror = () => {
      script.remove();
      fail(new Error('The verification service could not be loaded.'));
    };
    document.head.append(script);
  });

  return loading.then(() => undefined);
}

/**
 * Resolves once the widget has put its methods on `window`.
 *
 * Polled, because the widget announces readiness in no other way — there is no
 * event and no promise, only the methods appearing. `getWidgetData()` is the
 * documented way to read the fetched configuration and would do as a signal
 * too; the methods themselves are the more direct precondition, because they
 * are exactly what the next call needs.
 */
function whenExposed(target: Msg91Window): Promise<void> {
  return waitFor(
    () =>
      typeof target.sendOtp === 'function' &&
      typeof target.retryOtp === 'function' &&
      typeof target.verifyOtp === 'function',
    READY_TIMEOUT_MS,
  ).catch(() => {
    throw new Error(
      'The verification service did not finish starting up. Check that this domain is ' +
        'allow-listed on the MSG91 widget.',
    );
  });
}

/** Polls `ready` until it is true, or rejects at the deadline. */
function waitFor(ready: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (ready()) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (ready()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('timed out'));
      }
    }, 50);
  });
}

/** `sendOtp`. `identifier` is digits with the country code and no `+`. */
export function sendMsg91Otp(identifier: string): Promise<void> {
  return call('sendOtp', (target, resolve, reject) => {
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
  return call('retryOtp', (target, resolve, reject) => {
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
  return call<string>('verifyOtp', (target, resolve, reject) => {
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

/**
 * One widget call, as a promise that is guaranteed to settle.
 *
 * Three things have to be true for that guarantee, and the first two were the
 * bug this function exists in its current shape to prevent:
 *
 *   · **the method is there.** `target.sendOtp?.(…)` on an undefined `sendOtp`
 *     is not an error — it is nothing at all, and "nothing at all" inside a
 *     promise executor is a promise that never settles. The method is checked
 *     for by name, and its absence is a rejection.
 *   · **the widget has finished starting.** `initSendOTP` existing says the
 *     script arrived, not that the widget is usable; `whenExposed` is what
 *     waits for the difference.
 *   · **the provider answers.** These are callback APIs. A callback that is
 *     never invoked has to become a rejection at some point, or the caller
 *     waits forever — which, from a dealer's side, is a spinner that never
 *     stops and an error message that never appears.
 */
function call<T>(
  method: 'sendOtp' | 'retryOtp' | 'verifyOtp',
  run: (target: Msg91Window, resolve: (value: T) => void, reject: (error: unknown) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const target = window as Msg91Window;

    if (typeof target.initSendOTP !== 'function') {
      reject(new Error('The verification service is not loaded.'));
      return;
    }

    // Settled once, by whichever of the three gets there first.
    let done = false;
    const settle =
      <A>(act: (value: A) => void) =>
      (value: A) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        act(value);
      };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(
        new Error(
          `The verification service did not respond to ${method}. It may be blocked on this ` +
            'page, or this domain may not be allow-listed on the MSG91 widget.',
        ),
      );
    }, CALL_TIMEOUT_MS);

    const ok = settle(resolve);
    const no = settle<unknown>((error) => {
      // The provider's own payload, which is the only place the real reason
      // ever appears — it is not a string and does not survive `catch {}`.
      console.error(`[msg91] ${method} failed`, error);
      reject(
        error instanceof Error ? error : new Error(`The verification service refused ${method}.`),
      );
    });

    whenExposed(target).then(
      () => {
        if (typeof target[method] !== 'function') {
          no(new Error(`The verification service exposed no ${method}.`));
          return;
        }
        try {
          run(target, ok, no);
        } catch (error) {
          no(error);
        }
      },
      (error: unknown) => {
        no(error);
      },
    );
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
